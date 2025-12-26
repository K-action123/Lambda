import os
import json
import boto3
import requests
import pandas as pd
import numpy as np
import time
from datetime import datetime
from boto3.dynamodb.conditions import Key

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns')
table_name = os.environ.get('DYNAMODB_TABLE', 'FintechPriceHistory')
sns_topic_arn = os.environ.get('SNS_TOPIC_ARN')

def calculate_rsi(prices, period=14):
    """Calculate Relative Strength Index (RSI) using Pandas."""
    if len(prices) < period + 1:
        return None
    
    delta = prices.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    
    avg_gain = gain.iloc[-1]
    avg_loss = loss.iloc[-1]
    
    if avg_loss == 0:
        return 100.0 if avg_gain > 0 else 50.0
    
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return float(rsi)

def fetch_crypto_price(symbol="BTC-USDT"):
    """Fetch real-time price from OKX public API."""
    url = f"https://www.okx.com/api/v5/market/ticker?instId={symbol}"
    try:
        response = requests.get(url)
        data = response.json()
        if data['code'] == '0':
            return float(data['data'][0]['last'])
    except Exception as e:
        print(f"Error fetching price: {e}")
    return None

def fetch_historical_candles(symbol="BTC-USDT", limit=50):
    """Fetch historical candles from OKX for RSI warm-up."""
    url = f"https://www.okx.com/api/v5/market/candles?instId={symbol}&limit={limit}"
    try:
        response = requests.get(url)
        data = response.json()
        if data['code'] == '0':
            # OKX returns candles as [ts, open, high, low, close, vol, volCcy, volCcyQuote, confirm]
            # We want the close prices (index 4)
            return [float(c[4]) for c in reversed(data['data'])]
    except Exception as e:
        print(f"Error fetching candles: {e}")
    return []

def lambda_handler(event, context):
    # 1. Configuration & Data Fetching
    symbol = "BTC-USDT"
    price = fetch_crypto_price(symbol)
    
    if price is None:
        return {"statusCode": 500, "body": json.dumps("Failed to fetch price from OKX")}

    # 2. Calculate Timestamps
    current_time = int(time.time())
    # TTL: Current time + seconds in 30 days (60s * 60m * 24h * 30d)
    expiration_time = current_time + (60 * 60 * 24 * 30) 

    # 3. Prepare the item
    item = {
        'Symbol': symbol,
        'Timestamp': current_time,
        'Price': str(price),
        'ExpiresAt': expiration_time
    }

    # 4. Write to DynamoDB
    table = dynamodb.Table(table_name)
    try:
        table.put_item(Item=item)
        print(f"Successfully stored {symbol} price at {current_time}. Expires at {expiration_time}")
    except Exception as e:
        print(f"Error writing to DynamoDB: {str(e)}")
        # We continue even if DB write fails, to try and return current stats

    # 5. Fetch recent prices from DynamoDB for RSI calculation
    response = table.query(
        KeyConditionExpression=Key('Symbol').eq(symbol),
        ScanIndexForward=False, # Newest first
        Limit=30 
    )
    
    items = response.get('Items', [])
    
    # 6. RSI Calculation (with warm-up if needed)
    if len(items) < 15:
        print("Not enough data in DynamoDB, fetching historical candles from OKX for warm-up...")
        historical_prices = fetch_historical_candles(symbol, limit=30) 
        if historical_prices:
            db_prices_reversed = [float(item['Price']) for item in reversed(items)]
            combined_prices = historical_prices + db_prices_reversed
            prices = pd.Series(combined_prices).drop_duplicates()
        else:
            prices = pd.Series([])
    else:
        prices = pd.Series([float(item['Price']) for item in reversed(items)])

    rsi = None
    if not prices.empty and len(prices) >= 15: 
        rsi = calculate_rsi(prices)
        print(f"Current Price: {price} | RSI: {rsi}")
        
        # 7. Alert logic
        if rsi is not None and sns_topic_arn:
            if rsi > 70:
                message = f"🚨 {symbol} Alert!\nPrice: ${price}\nRSI: {rsi:.2f} (Overbought)"
                sns.publish(TopicArn=sns_topic_arn, Message=message, Subject="Fintech Monitor Alert")
            elif rsi < 30:
                message = f"🚨 {symbol} Alert!\nPrice: ${price}\nRSI: {rsi:.2f} (Oversold)"
                sns.publish(TopicArn=sns_topic_arn, Message=message, Subject="Fintech Monitor Alert")

    return {
        'statusCode': 200,
        'body': json.dumps({
            'symbol': symbol,
            'price': price,
            'timestamp': current_time,
            'rsi': rsi,
            'expiresAt': expiration_time
        })
    }