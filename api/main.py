import os
import json
import datetime
import threading
import time as _time
from typing import Optional, List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np
import pandas as pd
import requests
import yfinance as yf
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="ChabAlgo Terminal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "")
ALPHA_VANTAGE_API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "")

# In-memory portfolio store
portfolio: Dict[str, Dict[str, Any]] = {}


class PortfolioPosition(BaseModel):
    ticker: str
    shares: float
    avg_price: float


# --- Helper functions ---

def finnhub_get(endpoint: str, params: dict = None) -> Optional[dict]:
    if not FINNHUB_API_KEY:
        return None
    try:
        base = "https://finnhub.io/api/v1"
        p = {"token": FINNHUB_API_KEY}
        if params:
            p.update(params)
        r = requests.get(f"{base}/{endpoint}", params=p, timeout=10)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return None


def alpha_vantage_get(function: str, symbol: str, extra: dict = None) -> Optional[dict]:
    if not ALPHA_VANTAGE_API_KEY:
        return None
    try:
        params = {
            "function": function,
            "symbol": symbol,
            "apikey": ALPHA_VANTAGE_API_KEY,
        }
        if extra:
            params.update(extra)
        r = requests.get("https://www.alphavantage.co/query", params=params, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if "Error Message" in data or "Note" in data:
                return None
            return data
    except Exception:
        pass
    return None


def get_realtime_price(ticker: str) -> dict:
    """Get real-time price. Finnhub first, yfinance fallback."""
    # Try Finnhub
    data = finnhub_get("quote", {"symbol": ticker})
    if data and data.get("c") and data["c"] > 0:
        return {
            "price": round(data["c"], 2),
            "change": round(data["d"], 2) if data.get("d") else 0,
            "change_percent": round(data["dp"], 2) if data.get("dp") else 0,
            "high": round(data.get("h", 0), 2),
            "low": round(data.get("l", 0), 2),
            "open": round(data.get("o", 0), 2),
            "prev_close": round(data.get("pc", 0), 2),
            "currency": "USD",
            "source": "finnhub",
        }

    # Fallback: yfinance
    try:
        t = yf.Ticker(ticker)
        info = t.info
        price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
        if price:
            prev = info.get("previousClose", price)
            change = round(price - prev, 2)
            change_pct = round((change / prev) * 100, 2) if prev else 0
            currency = info.get("currency", "USD")
            return {
                "price": round(price, 2),
                "change": change,
                "change_percent": change_pct,
                "high": round(info.get("dayHigh", 0) or 0, 2),
                "low": round(info.get("dayLow", 0) or 0, 2),
                "open": round(info.get("open", 0) or 0, 2),
                "prev_close": round(prev, 2),
                "currency": currency,
                "source": "yfinance",
            }
    except Exception:
        pass

    return {}


def get_company_profile(ticker: str) -> dict:
    """Get company name, market cap, etc."""
    # Finnhub profile
    data = finnhub_get("stock/profile2", {"symbol": ticker})
    if data and data.get("name"):
        return {
            "name": data.get("name", ""),
            "market_cap": data.get("marketCapitalization", 0) * 1e6 if data.get("marketCapitalization") else 0,
            "industry": data.get("finnhubIndustry", ""),
            "exchange": data.get("exchange", ""),
            "logo": data.get("logo", ""),
            "source": "finnhub",
        }

    # Fallback: yfinance
    try:
        t = yf.Ticker(ticker)
        info = t.info
        return {
            "name": info.get("longName") or info.get("shortName", ""),
            "market_cap": info.get("marketCap", 0) or 0,
            "industry": info.get("industry", ""),
            "exchange": info.get("exchange", ""),
            "logo": "",
            "source": "yfinance",
        }
    except Exception:
        pass
    return {}


def get_fundamentals(ticker: str) -> dict:
    """Get fundamentals from Alpha Vantage, yfinance fallback."""
    result = {
        "pe_ratio": None,
        "forward_pe": None,
        "revenue_growth_yoy": None,
        "gross_margin": None,
        "operating_margin": None,
        "eps_last_quarter": None,
        "eps_estimate": None,
        "eps_surprise_pct": None,
        "net_debt": None,
        "source": "unavailable",
    }

    # Try Alpha Vantage overview
    overview = alpha_vantage_get("OVERVIEW", ticker)
    if overview and overview.get("Symbol"):
        result["source"] = "alpha_vantage"
        result["pe_ratio"] = _safe_float(overview.get("TrailingPE"))
        result["forward_pe"] = _safe_float(overview.get("ForwardPE"))
        result["revenue_growth_yoy"] = _safe_float(overview.get("QuarterlyRevenueGrowthYOY"))
        result["gross_margin"] = _safe_float(overview.get("GrossProfitTTM"))  # will compute ratio below
        result["operating_margin"] = _safe_float(overview.get("OperatingMarginTTM"))
        result["eps_last_quarter"] = _safe_float(overview.get("EPS"))

        # Compute gross margin as ratio if we have revenue
        revenue_ttm = _safe_float(overview.get("RevenueTTM"))
        gross_profit_ttm = _safe_float(overview.get("GrossProfitTTM"))
        if revenue_ttm and gross_profit_ttm:
            result["gross_margin"] = round(gross_profit_ttm / revenue_ttm * 100, 1)

        # Try earnings for surprise
        earnings = alpha_vantage_get("EARNINGS", ticker)
        if earnings and earnings.get("quarterlyEarnings"):
            latest = earnings["quarterlyEarnings"][0]
            result["eps_last_quarter"] = _safe_float(latest.get("reportedEPS"))
            result["eps_estimate"] = _safe_float(latest.get("estimatedEPS"))
            if result["eps_last_quarter"] is not None and result["eps_estimate"] is not None and result["eps_estimate"] != 0:
                result["eps_surprise_pct"] = round(
                    ((result["eps_last_quarter"] - result["eps_estimate"]) / abs(result["eps_estimate"])) * 100, 1
                )

        # Net debt from balance sheet
        bs = alpha_vantage_get("BALANCE_SHEET", ticker)
        if bs and bs.get("quarterlyReports"):
            latest_bs = bs["quarterlyReports"][0]
            total_debt = _safe_float(latest_bs.get("shortLongTermDebtTotal")) or (
                (_safe_float(latest_bs.get("shortTermDebt")) or 0) +
                (_safe_float(latest_bs.get("longTermDebt")) or 0)
            )
            cash = _safe_float(latest_bs.get("cashAndCashEquivalentsAtCarryingValue")) or \
                   _safe_float(latest_bs.get("cashAndShortTermInvestments")) or 0
            if total_debt is not None:
                result["net_debt"] = round(total_debt - cash, 0)

        return result

    # Fallback: yfinance
    try:
        t = yf.Ticker(ticker)
        info = t.info
        result["source"] = "yfinance"
        result["pe_ratio"] = _safe_float(info.get("trailingPE"))
        result["forward_pe"] = _safe_float(info.get("forwardPE"))
        result["revenue_growth_yoy"] = _pct(info.get("revenueGrowth"))
        result["gross_margin"] = _pct(info.get("grossMargins"))
        result["operating_margin"] = _pct(info.get("operatingMargins"))

        # EPS
        result["eps_last_quarter"] = _safe_float(info.get("trailingEps"))

        # Net debt
        total_debt = info.get("totalDebt", 0) or 0
        total_cash = info.get("totalCash", 0) or 0
        if total_debt or total_cash:
            result["net_debt"] = round(total_debt - total_cash, 0)
    except Exception:
        pass

    return result


def get_technicals(ticker: str) -> dict:
    """Compute MA50, MA200, RSI from yfinance historical data."""
    result = {
        "ma50": None,
        "ma200": None,
        "price_vs_ma50": None,
        "price_vs_ma200": None,
        "rsi": None,
        "rsi_signal": None,
        "signal": None,
        "signal_reason": None,
        "source": "unavailable",
    }

    try:
        t = yf.Ticker(ticker)
        hist = t.history(period="1y")
        if hist.empty or len(hist) < 14:
            return result

        closes = hist["Close"].values
        current_price = closes[-1]

        # MA50
        if len(closes) >= 50:
            ma50 = float(np.mean(closes[-50:]))
            result["ma50"] = round(ma50, 2)
            result["price_vs_ma50"] = "above" if current_price > ma50 else "below"

        # MA200
        if len(closes) >= 200:
            ma200 = float(np.mean(closes[-200:]))
            result["ma200"] = round(ma200, 2)
            result["price_vs_ma200"] = "above" if current_price > ma200 else "below"

        # RSI (Wilder's smoothing)
        rsi_val = compute_rsi(closes, period=14)
        if rsi_val is not None:
            result["rsi"] = round(rsi_val, 1)
            if rsi_val < 35:
                result["rsi_signal"] = "oversold"
            elif rsi_val > 65:
                result["rsi_signal"] = "overbought"
            else:
                result["rsi_signal"] = "neutral"

        # Overall signal
        bullish_count = 0
        bearish_count = 0

        if result["price_vs_ma50"] == "above":
            bullish_count += 1
        elif result["price_vs_ma50"] == "below":
            bearish_count += 1

        if result["price_vs_ma200"] == "above":
            bullish_count += 1
        elif result["price_vs_ma200"] == "below":
            bearish_count += 1

        if result["rsi_signal"] == "oversold":
            bullish_count += 1  # contrarian
        elif result["rsi_signal"] == "overbought":
            bearish_count += 1

        if bullish_count > bearish_count:
            result["signal"] = "Bullish"
            reasons = []
            if result["price_vs_ma50"] == "above":
                reasons.append("above MA50")
            if result["price_vs_ma200"] == "above":
                reasons.append("above MA200")
            if result["rsi_signal"] == "oversold":
                reasons.append("RSI oversold (reversal)")
            result["signal_reason"] = ", ".join(reasons)
        elif bearish_count > bullish_count:
            result["signal"] = "Bearish"
            reasons = []
            if result["price_vs_ma50"] == "below":
                reasons.append("below MA50")
            if result["price_vs_ma200"] == "below":
                reasons.append("below MA200")
            if result["rsi_signal"] == "overbought":
                reasons.append("RSI overbought")
            result["signal_reason"] = ", ".join(reasons)
        else:
            result["signal"] = "Neutral"
            result["signal_reason"] = "mixed signals"

        result["source"] = "yfinance"
    except Exception:
        pass

    return result


def compute_rsi(closes: np.ndarray, period: int = 14) -> Optional[float]:
    """Compute RSI using Wilder's smoothing method."""
    if len(closes) < period + 1:
        return None

    deltas = np.diff(closes)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)

    # Initial average
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])

    # Wilder's smoothing
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    if avg_loss == 0:
        return 100.0

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return float(rsi)


def get_historical_data(ticker: str, period: str = "1y") -> list:
    """Get OHLCV data from yfinance."""
    try:
        t = yf.Ticker(ticker)
        hist = t.history(period=period)
        if hist.empty:
            return []

        closes = hist["Close"].values
        records = []
        for i, (date, row) in enumerate(hist.iterrows()):
            entry = {
                "date": date.strftime("%Y-%m-%d"),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            }

            # Compute MA50 and MA200 at each point
            idx = i + 1
            if idx >= 50:
                entry["ma50"] = round(float(np.mean(closes[idx - 50:idx])), 2)
            if idx >= 200:
                entry["ma200"] = round(float(np.mean(closes[idx - 200:idx])), 2)

            # Compute RSI at each point (need at least period+1 data points)
            if idx >= 15:
                rsi_val = compute_rsi(closes[:idx], period=14)
                if rsi_val is not None:
                    entry["rsi"] = round(rsi_val, 1)

            records.append(entry)

        return records
    except Exception:
        return []


def get_news(ticker: str) -> list:
    """Get news from Finnhub."""
    now = datetime.datetime.now()
    from_date = (now - datetime.timedelta(days=7)).strftime("%Y-%m-%d")
    to_date = now.strftime("%Y-%m-%d")

    data = finnhub_get("company-news", {
        "symbol": ticker,
        "from": from_date,
        "to": to_date,
    })

    if not data or not isinstance(data, list):
        return []

    news = []
    for item in data[:5]:
        news.append({
            "headline": item.get("headline", ""),
            "source": item.get("source", ""),
            "url": item.get("url", ""),
            "datetime": item.get("datetime", 0),
            "summary": item.get("summary", ""),
        })

    return news


def get_sentiment(ticker: str) -> dict:
    """Get analyst recommendation sentiment from Finnhub."""
    data = finnhub_get("stock/recommendation", {"symbol": ticker})
    if data and isinstance(data, list) and len(data) > 0:
        latest = data[0]
        strong_buy = latest.get("strongBuy", 0)
        buy = latest.get("buy", 0)
        hold = latest.get("hold", 0)
        sell = latest.get("sell", 0)
        strong_sell = latest.get("strongSell", 0)
        total = strong_buy + buy + hold + sell + strong_sell

        if total == 0:
            return {"score": 0.5, "label": "Neutral", "analysts_total": 0,
                    "strong_buy": 0, "buy": 0, "hold": 0, "sell": 0, "strong_sell": 0,
                    "period": "", "source": "unavailable"}

        # Weighted score: strongBuy=1.0, buy=0.75, hold=0.5, sell=0.25, strongSell=0.0
        score = (strong_buy * 1.0 + buy * 0.75 + hold * 0.5 + sell * 0.25 + strong_sell * 0.0) / total

        if score >= 0.7:
            label = "Bullish"
        elif score <= 0.4:
            label = "Bearish"
        else:
            label = "Neutral"

        return {
            "score": round(score, 2),
            "label": label,
            "analysts_total": total,
            "strong_buy": strong_buy,
            "buy": buy,
            "hold": hold,
            "sell": sell,
            "strong_sell": strong_sell,
            "period": latest.get("period", ""),
            "source": "finnhub",
        }
    return {"score": 0.5, "label": "Neutral", "analysts_total": 0,
            "strong_buy": 0, "buy": 0, "hold": 0, "sell": 0, "strong_sell": 0,
            "period": "", "source": "unavailable"}


def _safe_float(val) -> Optional[float]:
    if val is None or val == "None" or val == "-":
        return None
    try:
        return round(float(val), 2)
    except (ValueError, TypeError):
        return None


def _pct(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return round(float(val) * 100, 1)
    except (ValueError, TypeError):
        return None


# PEA-eligible European stocks (name -> yfinance ticker)
# Covers: France (.PA), Germany (.DE), Netherlands (.AS), Italy (.MI),
#          Spain (.MC), Belgium (.BR), Finland (.HE), Ireland (.IR/.L), Portugal (.LS)
EU_STOCK_MAP = {
    # ========== FRANCE (.PA) - CAC 40 + Mid/Small ==========
    # CAC 40
    "lvmh": "MC.PA", "mc": "MC.PA",
    "hermes": "RMS.PA", "rms": "RMS.PA", "hermès": "RMS.PA",
    "total": "TTE.PA", "totalenergies": "TTE.PA", "tte": "TTE.PA",
    "airbus": "AIR.PA", "air": "AIR.PA",
    "sanofi": "SAN.PA", "san": "SAN.PA",
    "loreal": "OR.PA", "l'oreal": "OR.PA", "l'oréal": "OR.PA",
    "schneider": "SU.PA", "schneider electric": "SU.PA",
    "dassault systemes": "DSY.PA", "dsy": "DSY.PA",
    "safran": "SAF.PA", "saf": "SAF.PA",
    "bnp": "BNP.PA", "bnp paribas": "BNP.PA",
    "axa": "CS.PA", "cs": "CS.PA",
    "vinci": "DG.PA", "dg": "DG.PA",
    "kering": "KER.PA", "ker": "KER.PA",
    "danone": "BN.PA", "bn": "BN.PA",
    "pernod": "RI.PA", "pernod ricard": "RI.PA", "ri": "RI.PA",
    "stmicroelectronics": "STM.PA", "stm": "STM.PA", "stmicro": "STM.PA",
    "capgemini": "CAP.PA", "cap": "CAP.PA",
    "engie": "ENGI.PA", "engi": "ENGI.PA",
    "orange": "ORA.PA", "ora": "ORA.PA",
    "societe generale": "GLE.PA", "gle": "GLE.PA", "socgen": "GLE.PA",
    "credit agricole": "ACA.PA", "aca": "ACA.PA",
    "renault": "RNO.PA", "rno": "RNO.PA",
    "veolia": "VIE.PA", "vie": "VIE.PA",
    "bouygues": "EN.PA", "en": "EN.PA",
    "thales": "HO.PA", "ho": "HO.PA",
    "michelin": "ML.PA", "ml": "ML.PA",
    "saint gobain": "SGO.PA", "sgo": "SGO.PA", "saint-gobain": "SGO.PA",
    "legrand": "LR.PA", "lr": "LR.PA",
    "publicis": "PUB.PA", "pub": "PUB.PA",
    "teleperformance": "TEP.PA", "tep": "TEP.PA",
    "essilor": "EL.PA", "essilorluxottica": "EL.PA", "el": "EL.PA",
    "vivendi": "VIV.PA", "viv": "VIV.PA",
    "eurofins": "ERF.PA", "erf": "ERF.PA",
    "worldline": "WLN.PA", "wln": "WLN.PA",
    "stellantis": "STLAP.PA", "stla": "STLAP.PA",
    "alstom": "ALO.PA", "alo": "ALO.PA",
    # Mid & Small caps FR
    "soitec": "SOI.PA", "soi": "SOI.PA",
    "exail": "EXA.PA", "exail technologies": "EXA.PA", "exa": "EXA.PA",
    "exosens": "EXENS.PA", "exens": "EXENS.PA",
    "2crsi": "2CRSI.PA",
    "ovh": "OVH.PA", "ovhcloud": "OVH.PA", "ovh cloud": "OVH.PA",
    "ovalto": "OVH.PA",
    "dassault aviation": "AM.PA",
    "atos": "ATO.PA",
    "kalray": "ALKAL.PA", "alkal": "ALKAL.PA",
    "believe": "BLV.PA", "blv": "BLV.PA",
    "solutions 30": "S30.PA", "s30": "S30.PA",
    "navya": "NAVYA.PA",
    "wallix": "ALLIX.PA", "allix": "ALLIX.PA",
    "verimatrix": "VMX.PA", "vmx": "VMX.PA",
    "drone volt": "ALDRV.PA", "aldrv": "ALDRV.PA",
    "theranexus": "ALTHX.PA", "althx": "ALTHX.PA",
    "forsee power": "FORSE.PA", "forse": "FORSE.PA",
    "lacroix": "LACR.PA", "lacr": "LACR.PA",
    "lumibird": "LBIRD.PA", "lbird": "LBIRD.PA",
    "mersen": "MRN.PA", "mrn": "MRN.PA",
    "ateme": "ATEME.PA",
    "streamwide": "ALSTW.PA", "alstw": "ALSTW.PA",
    "planisware": "PLNW.PA", "plnw": "PLANISWARE.PA",
    "dassault aviation": "AM.PA", "am": "AM.PA",
    "biomerieux": "BIM.PA", "bim": "BIM.PA",
    "sartorius stedim": "DIM.PA", "dim": "DIM.PA",
    "edenred": "EDEN.PA", "eden": "EDEN.PA",
    "arkema": "AKE.PA", "ake": "AKE.PA",
    "bureau veritas": "BVI.PA", "bvi": "BVI.PA",
    "getlink": "GET.PA", "get": "GET.PA", "eurotunnel": "GET.PA",
    "jcdecaux": "DEC.PA", "dec": "DEC.PA",
    "rubis": "RUI.PA", "rui": "RUI.PA",
    "nexans": "NEX.PA", "nex": "NEX.PA",
    "valeo": "FR.PA", "fr": "FR.PA",
    "atos": "ATO.PA", "ato": "ATO.PA",
    "ipsen": "IPN.PA", "ipn": "IPN.PA",
    "imerys": "NK.PA", "nk": "NK.PA",
    "trigano": "TRI.PA", "tri": "TRI.PA",
    "interparfums": "ITP.PA", "itp": "ITP.PA",
    "coface": "COFA.PA", "cofa": "COFA.PA",
    "nexity": "NXI.PA", "nxi": "NXI.PA",
    "ose immuno": "OSE.PA", "ose": "OSE.PA",
    "eiffage": "FGR.PA", "fgr": "FGR.PA",
    "spie": "SPIE.PA", "spie": "SPIE.PA",
    "sopra steria": "SOP.PA", "sop": "SOP.PA",
    "sword group": "SWP.PA", "swp": "SWP.PA",
    "ubisoft": "UBI.PA", "ubi": "UBI.PA",
    "bolloré": "BOL.PA", "bollore": "BOL.PA", "bol": "BOL.PA",
    "elf beaute": "ELF.PA", "elf": "ELF.PA",
    "carrefour": "CA.PA", "ca": "CA.PA",
    "remy cointreau": "RCO.PA", "rco": "RCO.PA",
    "casino": "CO.PA", "co": "CO.PA",
    "technip": "FTI.PA", "technipfmc": "FTI.PA",
    "accor": "AC.PA", "ac": "AC.PA",
    "klepierre": "LI.PA", "li": "LI.PA",
    "unibail": "URW.PA", "unibail rodamco": "URW.PA", "urw": "URW.PA",
    "gecina": "GFC.PA", "gfc": "GFC.PA",
    "covivio": "COV.PA", "cov": "COV.PA",
    "scor": "SCR.PA", "scr": "SCR.PA",
    "eurazeo": "RF.PA", "rf": "RF.PA",
    "wendel": "MF.PA", "mf": "MF.PA",
    "amundi": "AMUN.PA", "amun": "AMUN.PA",
    "tikehau": "TKO.PA", "tko": "TKO.PA",
    "cac 40 etf": "CAC.PA",
    # ========== GERMANY (.DE) - DAX + MDAX ==========
    "siemens": "SIE.DE", "sie": "SIE.DE",
    "sap": "SAP.DE",
    "allianz": "ALV.DE", "alv": "ALV.DE",
    "bmw": "BMW.DE",
    "volkswagen": "VOW3.DE", "vw": "VOW3.DE",
    "mercedes": "MBG.DE", "mbg": "MBG.DE", "mercedes benz": "MBG.DE",
    "porsche": "P911.DE", "p911": "P911.DE",
    "adidas": "ADS.DE", "ads": "ADS.DE",
    "bayer": "BAYN.DE", "bayn": "BAYN.DE",
    "basf": "BAS.DE", "bas": "BAS.DE",
    "deutsche bank": "DBK.DE", "dbk": "DBK.DE",
    "deutsche post": "DHL.DE", "dhl": "DHL.DE",
    "deutsche telekom": "DTE.DE", "dte": "DTE.DE",
    "munich re": "MUV2.DE", "muv2": "MUV2.DE", "munchener ruck": "MUV2.DE",
    "infineon": "IFX.DE", "ifx": "IFX.DE",
    "henkel": "HEN3.DE", "hen3": "HEN3.DE",
    "continental": "CON.DE", "con": "CON.DE",
    "rheinmetall": "RHM.DE", "rhm": "RHM.DE",
    "commerzbank": "CBK.DE", "cbk": "CBK.DE",
    "zalando": "ZAL.DE", "zal": "ZAL.DE",
    "hellofresh": "HFG.DE", "hfg": "HFG.DE",
    "siemens energy": "ENR.DE", "enr": "ENR.DE",
    "siemens healthineers": "SHL.DE", "shl": "SHL.DE",
    "fresenius": "FRE.DE", "fre": "FRE.DE",
    "merck kgaa": "MRK.DE",
    "hannover ruck": "HNR1.DE", "hnr1": "HNR1.DE",
    "puma": "PUM.DE", "pum": "PUM.DE",
    "sartorius": "SRT3.DE", "srt3": "SRT3.DE",
    "symrise": "SY1.DE", "sy1": "SY1.DE",
    "vonovia": "VNA.DE", "vna": "VNA.DE",
    "brenntag": "BNR.DE", "bnr": "BNR.DE",
    "covestro": "1COV.DE",
    "eon": "EOAN.DE", "eoan": "EOAN.DE",
    "rwe": "RWE.DE", "rwe": "RWE.DE",
    "thyssenkrupp": "TKA.DE", "tka": "TKA.DE",
    "heidelberg materials": "HEI.DE", "hei": "HEI.DE",
    # ========== NETHERLANDS (.AS) - Euronext Amsterdam ==========
    "asml": "ASML.AS",
    "shell": "SHEL.AS", "shel": "SHEL.AS", "royal dutch shell": "SHEL.AS",
    "philips": "PHIA.AS", "phia": "PHIA.AS",
    "ing": "INGA.AS", "inga": "INGA.AS",
    "ahold": "AD.AS", "ahold delhaize": "AD.AS", "ad": "AD.AS",
    "heineken": "HEIA.AS", "heia": "HEIA.AS",
    "unilever": "UNA.AS", "una": "UNA.AS",
    "prosus": "PRX.AS", "prx": "PRX.AS",
    "wolters kluwer": "WKL.AS", "wkl": "WKL.AS",
    "adyen": "ADYEN.AS", "adyen": "ADYEN.AS",
    "nn group": "NN.AS", "nn": "NN.AS",
    "aegon": "AGN.AS", "agn": "AGN.AS",
    "akzo nobel": "AKZA.AS", "akza": "AKZA.AS",
    "dsm firmenich": "DSFIR.AS",
    "randstad": "RAND.AS", "rand": "RAND.AS",
    "just eat takeaway": "JTKWY", "just eat": "JTKWY",
    "arcelormittal": "MT.AS", "mt": "MT.AS",
    "exor": "EXO.AS", "exo": "EXO.AS",
    "be semiconductor": "BESI.AS", "besi": "BESI.AS",
    "asm international": "ASM.AS", "asm": "ASM.AS",
    # ========== ITALY (.MI) - FTSE MIB ==========
    "ferrari": "RACE.MI", "race": "RACE.MI",
    "enel": "ENEL.MI", "enel": "ENEL.MI",
    "eni": "ENI.MI",
    "intesa": "ISP.MI", "intesa sanpaolo": "ISP.MI", "isp": "ISP.MI",
    "unicredit": "UCG.MI", "ucg": "UCG.MI",
    "generali": "G.MI",
    "tenaris": "TEN.MI", "ten": "TEN.MI",
    "moncler": "MONC.MI", "monc": "MONC.MI",
    "campari": "CPR.MI", "cpr": "CPR.MI",
    "prysmian": "PRY.MI", "pry": "PRY.MI",
    "leonardo": "LDO.MI", "ldo": "LDO.MI",
    "mediobanca": "MB.MI", "mb": "MB.MI",
    "finecobank": "FBK.MI", "fbk": "FBK.MI",
    "nexi": "NEXI.MI", "nexi": "NEXI.MI",
    "saipem": "SPM.MI", "spm": "SPM.MI",
    "poste italiane": "PST.MI", "pst": "PST.MI",
    "banco bpm": "BAMI.MI", "bami": "BAMI.MI",
    "recordati": "REC.MI", "rec": "REC.MI",
    "brunello cucinelli": "BC.MI", "bc": "BC.MI",
    "pirelli": "PIRC.MI", "pirc": "PIRC.MI",
    "amplifon": "AMP.MI", "amp": "AMP.MI",
    "telecom italia": "TIT.MI", "tit": "TIT.MI",
    # ========== SPAIN (.MC) - IBEX 35 ==========
    "inditex": "ITX.MC", "itx": "ITX.MC", "zara": "ITX.MC",
    "santander": "SAN.MC", "banco santander": "SAN.MC",
    "bbva": "BBVA.MC",
    "iberdrola": "IBE.MC", "ibe": "IBE.MC",
    "telefonica": "TEF.MC", "tef": "TEF.MC",
    "repsol": "REP.MC", "rep": "REP.MC",
    "caixabank": "CABK.MC", "cabk": "CABK.MC",
    "amadeus": "AMS.MC", "ams": "AMS.MC",
    "ferrovial": "FER.MC", "fer": "FER.MC",
    "cellnex": "CLNX.MC", "clnx": "CLNX.MC",
    "endesa": "ELE.MC", "ele": "ELE.MC",
    "naturgy": "NTGY.MC", "ntgy": "NTGY.MC",
    "aena": "AENA.MC", "aena": "AENA.MC",
    "grifols": "GRF.MC", "grf": "GRF.MC",
    "fluidra": "FDR.MC", "fdr": "FDR.MC",
    # ========== BELGIUM (.BR) - Euronext Brussels ==========
    "ab inbev": "ABI.BR", "abi": "ABI.BR", "anheuser busch": "ABI.BR",
    "ucb": "UCB.BR",
    "kbc": "KBC.BR",
    "sofina": "SOF.BR", "sof": "SOF.BR",
    "umicore": "UMI.BR", "umi": "UMI.BR",
    "solvay": "SOLB.BR", "solb": "SOLB.BR",
    "ageas": "AGS.BR", "ags": "AGS.BR",
    "d'ieteren": "DIE.BR", "die": "DIE.BR",
    "melexis": "MELE.BR", "mele": "MELE.BR",
    # ========== FINLAND (.HE) - Helsinki ==========
    "nokia": "NOKIA.HE",
    "nordea": "NDA-FI.HE",
    "kone": "KNEBV.HE", "knebv": "KNEBV.HE",
    "neste": "NESTE.HE",
    "wartsila": "WRT1V.HE", "wrt1v": "WRT1V.HE",
    "stora enso": "STERV.HE", "sterv": "STERV.HE",
    "upm": "UPM.HE",
    "fortum": "FORTUM.HE",
    "sampo": "SAMPO.HE",
    "elisa": "ELISA.HE",
    # ========== PORTUGAL (.LS) - Euronext Lisbon ==========
    "edp": "EDP.LS",
    "galp": "GALP.LS",
    "jerónimo martins": "JMT.LS", "jeronimo martins": "JMT.LS", "jmt": "JMT.LS",
    # ========== IRELAND (.IR / .L) ==========
    "ryanair": "RYA.IR",
    "crh": "CRH.L",
    "kerry group": "KYG.IR", "kyg": "KYG.IR",
    "smurfit kappa": "SK3.IR", "sk3": "SK3.IR",
    # ========== DENMARK (.CO) ==========
    "novo nordisk": "NOVO-B.CO", "novo": "NOVO-B.CO",
    "carlsberg": "CARL-B.CO",
    "vestas": "VWS.CO", "vws": "VWS.CO",
    "orsted": "ORSTED.CO",
    "pandora": "PNDORA.CO", "pndora": "PNDORA.CO",
    "dsv": "DSV.CO",
    "coloplast": "COLO-B.CO",
    "genmab": "GMAB.CO", "gmab": "GMAB.CO",
    # ========== SWEDEN (.ST) ==========
    "ericsson": "ERIC-B.ST", "eric": "ERIC-B.ST",
    "volvo": "VOLV-B.ST",
    "atlas copco": "ATCO-A.ST",
    "sandvik": "SAND.ST", "sand": "SAND.ST",
    "abb": "ABB.ST",
    "hexagon": "HEXA-B.ST",
    "evolution": "EVO.ST", "evo": "EVO.ST",
    "spotify": "SPOT",
    "hm": "HM-B.ST", "h&m": "HM-B.ST",
    "investor ab": "INVE-B.ST",
    "alfa laval": "ALFA.ST", "alfa": "ALFA.ST",
    # ========== SWITZERLAND (.SW) - NOT PEA but major EU ==========
    "nestle": "NESN.SW", "nesn": "NESN.SW",
    "novartis": "NOVN.SW", "novn": "NOVN.SW",
    "roche": "ROG.SW", "rog": "ROG.SW",
    "ubs": "UBSG.SW", "ubsg": "UBSG.SW",
    "zurich": "ZURN.SW", "zurn": "ZURN.SW",
    "richemont": "CFR.SW", "cfr": "CFR.SW",
    "swatch": "UHR.SW", "uhr": "UHR.SW",
    "lonza": "LONN.SW", "lonn": "LONN.SW",
    "givaudan": "GIVN.SW", "givn": "GIVN.SW",
}


def resolve_ticker(query: str) -> Optional[str]:
    """Resolve a company name or partial query to a ticker symbol."""
    query = query.strip()
    if not query:
        return None

    # Check EU stock map first (case-insensitive)
    lower = query.lower()
    if lower in EU_STOCK_MAP:
        return EU_STOCK_MAP[lower]

    # If it already contains a dot (like SOI.PA), accept it directly
    if "." in query and len(query) <= 12:
        return query.upper()

    # If it looks like a US ticker (all alpha, short, no spaces), try directly
    if query.replace("-", "").isalpha() and len(query) <= 5:
        return query.upper()

    # Otherwise search Finnhub for the company name
    data = finnhub_get("search", {"q": query})
    if data and data.get("result"):
        # Prefer common stock on US exchanges
        for item in data["result"]:
            symbol = item.get("symbol", "")
            stype = item.get("type", "")
            if stype == "Common Stock" and "." not in symbol:
                return symbol
        # Then try any common stock (including EU)
        for item in data["result"]:
            symbol = item.get("symbol", "")
            stype = item.get("type", "")
            if stype == "Common Stock":
                return symbol
        # Fallback: return first result
        if data["result"]:
            return data["result"][0].get("symbol", "")

    # Last resort: try as yfinance ticker directly to validate
    try:
        t = yf.Ticker(query.upper())
        info = t.info
        if info.get("currentPrice") or info.get("regularMarketPrice"):
            return query.upper()
    except Exception:
        pass

    return query.upper().replace(" ", "")


# --- API Endpoints ---

@app.get("/search")
def search_ticker(q: str):
    """Search for tickers by company name or symbol."""
    query = q.strip().lower()
    results = []
    seen_symbols = set()

    # Check EU stock map first
    for name, ticker in EU_STOCK_MAP.items():
        if query in name or name.startswith(query):
            if ticker not in seen_symbols:
                seen_symbols.add(ticker)
                # Get display name from yfinance
                try:
                    t = yf.Ticker(ticker)
                    desc = t.info.get("shortName", name.title())
                except Exception:
                    desc = name.title()
                results.append({
                    "symbol": ticker,
                    "description": desc,
                    "type": "Common Stock (EU)",
                })
            if len(results) >= 3:
                break

    # Then search Finnhub for US/international
    data = finnhub_get("search", {"q": q.strip()})
    if not data or not data.get("result"):
        return {"results": results[:8]}

    for item in data["result"][:10]:
        symbol = item.get("symbol", "")
        # Allow .PA (Paris) and .DE (Germany) tickers, skip other foreign
        if "." in symbol:
            suffix = symbol.split(".")[-1]
            if suffix not in ("PA", "DE", "L", "AS", "MC", "MI", "BR", "HE", "LS", "IR", "CO", "ST", "SW"):
                continue
        if symbol in seen_symbols:
            continue
        seen_symbols.add(symbol)
        results.append({
            "symbol": symbol,
            "description": item.get("description", ""),
            "type": item.get("type", ""),
        })
    return {"results": results[:8]}


def _sanitize(obj):
    """Recursively replace NaN/Inf floats with None for JSON safety."""
    import math
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    return obj


@app.get("/analyze/{ticker}")
def analyze(ticker: str):
    ticker = resolve_ticker(ticker)

    profile = get_company_profile(ticker)
    if not profile or not profile.get("name"):
        raise HTTPException(status_code=404, detail="Ticker not found")

    price_data = get_realtime_price(ticker)
    fundamentals = get_fundamentals(ticker)
    technicals = get_technicals(ticker)
    historical = get_historical_data(ticker)
    news = get_news(ticker)
    sentiment = get_sentiment(ticker)

    return _sanitize({
        "ticker": ticker,
        "profile": profile,
        "price": price_data,
        "fundamentals": fundamentals,
        "technicals": technicals,
        "historical": historical,
        "news": news,
        "sentiment": sentiment,
    })


@app.get("/verdict/{ticker}")
def verdict(ticker: str):
    """
    Long-term investment composite signal.
    Weights: Business Quality 35%, Growth & Earnings 25%, Analyst Consensus 20%,
             Insider Activity 10%, Price & Entry 10%.
    Score: 0 (max bearish) to 100 (max bullish).
    """
    ticker = resolve_ticker(ticker)

    factors = []

    # =========================================================
    # 1. BUSINESS QUALITY (weight: 35) -- the most important factor
    #    Is this a fundamentally strong company?
    # =========================================================
    biz_score = 50
    biz_details = []

    fundamentals = get_fundamentals(ticker)
    if fundamentals["source"] != "unavailable":
        sub_scores = []

        # Operating margin -- can this company actually make money?
        op_margin = fundamentals.get("operating_margin")
        if op_margin is not None:
            if op_margin > 30:
                sub_scores.append(90)
                biz_details.append({
                    "name": "Profitability",
                    "value": f"{op_margin:.1f}% operating margin",
                    "signal": "Excellent",
                    "explanation": f"For every $100 this company earns in revenue, it keeps ${op_margin:.0f} as profit. That's a sign of a dominant business -- it can charge premium prices because customers have few alternatives. Companies like this tend to compound wealth over decades.",
                })
            elif op_margin > 15:
                sub_scores.append(65)
                biz_details.append({
                    "name": "Profitability",
                    "value": f"{op_margin:.1f}% operating margin",
                    "signal": "Solid",
                    "explanation": f"A {op_margin:.0f}% operating margin means the company is reliably profitable. It's not the most dominant business, but it earns good money and can weather downturns.",
                })
            elif op_margin > 0:
                sub_scores.append(35)
                biz_details.append({
                    "name": "Profitability",
                    "value": f"{op_margin:.1f}% operating margin",
                    "signal": "Thin",
                    "explanation": f"Only {op_margin:.0f}% margin means the company barely turns a profit. A recession, new competitor, or cost increase could easily push it into losses. Risky for long-term holding.",
                })
            else:
                sub_scores.append(10)
                biz_details.append({
                    "name": "Profitability",
                    "value": f"{op_margin:.1f}% operating margin",
                    "signal": "Losing Money",
                    "explanation": f"This company spends more than it earns. Some high-growth companies do this on purpose (investing in growth), but if it doesn't turn profitable eventually, long-term holders get wiped out.",
                })

        # Gross margin -- does it have pricing power?
        gross_margin = fundamentals.get("gross_margin")
        if gross_margin is not None:
            if gross_margin > 60:
                sub_scores.append(85)
                biz_details.append({
                    "name": "Pricing Power",
                    "value": f"{gross_margin:.1f}% gross margin",
                    "signal": "Strong Moat",
                    "explanation": f"A {gross_margin:.0f}% gross margin means the company's products/services cost very little to deliver relative to what customers pay. This usually indicates a strong competitive advantage (or 'moat') -- think software, luxury brands, or monopoly-like businesses. Hard to compete against.",
                })
            elif gross_margin > 40:
                sub_scores.append(60)
                biz_details.append({
                    "name": "Pricing Power",
                    "value": f"{gross_margin:.1f}% gross margin",
                    "signal": "Decent",
                    "explanation": f"A {gross_margin:.0f}% gross margin is respectable. The company has some pricing power but faces competition that limits how much it can charge.",
                })
            else:
                sub_scores.append(30)
                biz_details.append({
                    "name": "Pricing Power",
                    "value": f"{gross_margin:.1f}% gross margin",
                    "signal": "Commodity",
                    "explanation": f"A {gross_margin:.0f}% gross margin suggests the company sells products/services that are hard to differentiate. Customers can easily switch to competitors, so the company can't charge premium prices. Harder to build long-term wealth here.",
                })

        # Net debt -- can it survive a crisis?
        net_debt = fundamentals.get("net_debt")
        mcap = None
        try:
            t = yf.Ticker(ticker)
            mcap = t.info.get("marketCap")
        except Exception:
            pass

        if net_debt is not None:
            if net_debt < 0:
                sub_scores.append(80)
                cash = abs(net_debt)
                biz_details.append({
                    "name": "Financial Health",
                    "value": f"Net cash: ${cash / 1e9:.1f}B",
                    "signal": "Fortress",
                    "explanation": f"This company has ${cash / 1e9:.1f}B more cash than debt. It's a 'fortress balance sheet' -- it can survive recessions, invest in growth, buy competitors, or return money to shareholders. You don't have to worry about this company going bankrupt.",
                })
            elif mcap and net_debt / mcap < 0.3:
                sub_scores.append(55)
                biz_details.append({
                    "name": "Financial Health",
                    "value": f"Net debt: ${net_debt / 1e9:.1f}B",
                    "signal": "Manageable",
                    "explanation": f"The company has ${net_debt / 1e9:.1f}B in net debt, which is manageable relative to its size. Not a red flag, but something to watch if interest rates rise or profits dip.",
                })
            else:
                sub_scores.append(25)
                biz_details.append({
                    "name": "Financial Health",
                    "value": f"Net debt: ${net_debt / 1e9:.1f}B",
                    "signal": "Heavy Debt",
                    "explanation": f"${net_debt / 1e9:.1f}B in net debt is significant. High debt means high interest payments, which eat into profits. In a downturn, heavily indebted companies are the first to struggle. Risky for long-term.",
                })

        if sub_scores:
            biz_score = sum(sub_scores) / len(sub_scores)
    else:
        biz_details.append({
            "name": "Business Quality", "value": "Unavailable", "signal": "N/A",
            "explanation": "Fundamental data could not be loaded.",
        })

    factors.append({"category": "Business Quality", "score": biz_score, "weight": 35, "details": biz_details})

    # =========================================================
    # 2. GROWTH & EARNINGS TRAJECTORY (weight: 25)
    #    Is the company growing? Are earnings accelerating?
    # =========================================================
    growth_score = 50
    growth_details = []

    if fundamentals["source"] != "unavailable":
        sub_scores = []

        # Revenue growth
        rg = fundamentals.get("revenue_growth_yoy")
        if rg is not None:
            if rg > 25:
                sub_scores.append(90)
                growth_details.append({
                    "name": "Revenue Growth",
                    "value": f"+{rg:.1f}% year-over-year",
                    "signal": "Exceptional",
                    "explanation": f"Revenue grew {rg:.0f}% in the last year. For context, the average S&P 500 company grows 5-8%. A company growing this fast is capturing massive market demand. If this continues, the stock price will eventually follow -- even if it dips short-term.",
                })
            elif rg > 10:
                sub_scores.append(70)
                growth_details.append({
                    "name": "Revenue Growth",
                    "value": f"+{rg:.1f}% year-over-year",
                    "signal": "Strong",
                    "explanation": f"Revenue grew {rg:.0f}% -- well above average. The company is gaining market share and expanding. This is the kind of growth that creates long-term wealth.",
                })
            elif rg > 0:
                sub_scores.append(45)
                growth_details.append({
                    "name": "Revenue Growth",
                    "value": f"+{rg:.1f}% year-over-year",
                    "signal": "Slow",
                    "explanation": f"Revenue grew only {rg:.0f}%. The company isn't shrinking, but it's not conquering new markets either. Long-term returns will likely come from valuation changes or dividends, not explosive growth.",
                })
            else:
                sub_scores.append(15)
                growth_details.append({
                    "name": "Revenue Growth",
                    "value": f"{rg:.1f}% year-over-year",
                    "signal": "Declining",
                    "explanation": f"Revenue is shrinking ({rg:.0f}%). This is the most important red flag for long-term investors. A company making less money each year will almost certainly see its stock price fall over time, regardless of what analysts say.",
                })

        # Forward PE vs current PE -- are earnings expected to grow?
        pe = fundamentals.get("pe_ratio")
        fwd_pe = fundamentals.get("forward_pe")
        if pe is not None and fwd_pe is not None and pe > 0:
            growth_ratio = fwd_pe / pe
            if growth_ratio < 0.6:
                sub_scores.append(85)
                growth_details.append({
                    "name": "Earnings Trajectory",
                    "value": f"PE drops from {pe:.0f} to {fwd_pe:.0f} (forward)",
                    "signal": "Accelerating",
                    "explanation": f"Analysts expect earnings to grow so fast that the PE ratio drops from {pe:.0f} to {fwd_pe:.0f} within a year. The stock looks expensive today, but it's 'growing into' its price. Like buying a house in a neighborhood about to boom -- it seems pricey now but looks cheap in a year.",
                })
            elif growth_ratio < 0.85:
                sub_scores.append(65)
                growth_details.append({
                    "name": "Earnings Trajectory",
                    "value": f"PE drops from {pe:.0f} to {fwd_pe:.0f} (forward)",
                    "signal": "Growing",
                    "explanation": f"Forward PE ({fwd_pe:.0f}) is lower than current ({pe:.0f}), meaning earnings are expected to grow. This is a positive sign -- the company is becoming cheaper over time as it earns more.",
                })
            elif growth_ratio > 1.15:
                sub_scores.append(25)
                growth_details.append({
                    "name": "Earnings Trajectory",
                    "value": f"PE rises from {pe:.0f} to {fwd_pe:.0f} (forward)",
                    "signal": "Slowing",
                    "explanation": f"Forward PE ({fwd_pe:.0f}) is higher than current ({pe:.0f}), meaning analysts expect earnings to decline. The stock is getting more expensive over time, not less. This is a warning sign for long-term holders.",
                })
            else:
                sub_scores.append(50)
                growth_details.append({
                    "name": "Earnings Trajectory",
                    "value": f"PE: {pe:.0f} now, {fwd_pe:.0f} forward",
                    "signal": "Stable",
                    "explanation": f"Earnings are expected to stay roughly flat. The company isn't growing fast, but it's not shrinking either. Stable can be fine for dividend stocks, but limits upside for growth investors.",
                })

        # Earnings beat consistency (from Finnhub)
        earnings = finnhub_get("stock/earnings", {"symbol": ticker})
        if earnings and isinstance(earnings, list) and len(earnings) >= 3:
            beats = sum(1 for e in earnings if e.get("actual") and e.get("estimate") and e["actual"] > e["estimate"])
            total_q = len(earnings)
            beat_rate = beats / total_q
            if beat_rate >= 0.75:
                sub_scores.append(80)
                growth_details.append({
                    "name": "Earnings Track Record",
                    "value": f"Beat estimates {beats}/{total_q} quarters",
                    "signal": "Consistent",
                    "explanation": f"The company beat analyst expectations in {beats} out of {total_q} recent quarters. This means management consistently delivers better results than even Wall Street predicts. It's a sign of a well-run company that under-promises and over-delivers.",
                })
            elif beat_rate >= 0.5:
                sub_scores.append(55)
                growth_details.append({
                    "name": "Earnings Track Record",
                    "value": f"Beat estimates {beats}/{total_q} quarters",
                    "signal": "Mixed",
                    "explanation": f"The company beat expectations {beats} out of {total_q} quarters -- roughly half and half. The company sometimes delivers, sometimes disappoints. Not a strong signal either way.",
                })
            else:
                sub_scores.append(20)
                growth_details.append({
                    "name": "Earnings Track Record",
                    "value": f"Beat estimates only {beats}/{total_q} quarters",
                    "signal": "Disappointing",
                    "explanation": f"The company missed analyst estimates in most recent quarters. This is a red flag -- it suggests the business is weakening or management is overpromising. Long-term investors should be cautious.",
                })

        if sub_scores:
            growth_score = sum(sub_scores) / len(sub_scores)

    factors.append({"category": "Growth & Earnings", "score": growth_score, "weight": 25, "details": growth_details})

    # =========================================================
    # 3. ANALYST CONSENSUS (weight: 20)
    #    What do professional analysts who study this company full-time think?
    # =========================================================
    analyst_score = 50
    analyst_details = []

    sentiment = get_sentiment(ticker)
    if sentiment["source"] != "unavailable" and sentiment["analysts_total"] > 0:
        analyst_score = sentiment["score"] * 100

        total_a = sentiment["analysts_total"]
        sb = sentiment["strong_buy"]
        b = sentiment["buy"]
        h = sentiment["hold"]
        s = sentiment["sell"]
        ss = sentiment["strong_sell"]
        bullish_pct = round((sb + b) / total_a * 100)
        bearish_pct = round((s + ss) / total_a * 100)

        if analyst_score >= 70:
            analyst_details.append({
                "name": f"Analyst Recommendations ({total_a} analysts)",
                "value": f"{bullish_pct}% say Buy, {bearish_pct}% say Sell",
                "signal": "Bullish",
                "explanation": f"Out of {total_a} professional analysts who study this company full-time, {sb + b} recommend buying and only {s + ss} say sell. These analysts set 12-month price targets -- so this reflects their view of where the stock will be in a year, not tomorrow. Strong long-term consensus.",
            })
        elif analyst_score <= 40:
            analyst_details.append({
                "name": f"Analyst Recommendations ({total_a} analysts)",
                "value": f"{bearish_pct}% say Sell, {bullish_pct}% say Buy",
                "signal": "Bearish",
                "explanation": f"Most of the {total_a} analysts covering this stock don't think it's worth buying at current prices. When the majority of professionals who study a company full-time are negative, it's worth listening -- though they can be wrong.",
            })
        else:
            analyst_details.append({
                "name": f"Analyst Recommendations ({total_a} analysts)",
                "value": f"{bullish_pct}% Buy, {round(h / total_a * 100)}% Hold, {bearish_pct}% Sell",
                "signal": "Mixed",
                "explanation": f"Analysts are divided on this stock. When the experts disagree, it often means the stock's future depends on uncertain factors (economy, competition, new products). Higher risk, but also potential opportunity if things break the right way.",
            })
    else:
        analyst_details.append({
            "name": "Analyst Recommendations", "value": "No data", "signal": "N/A",
            "explanation": "Analyst recommendation data is not available.",
        })

    factors.append({"category": "Analyst Consensus", "score": analyst_score, "weight": 20, "details": analyst_details})

    # =========================================================
    # 4. INSIDER CONFIDENCE (weight: 10)
    #    Are the people running this company buying or selling stock?
    #    Low weight because insiders sell for many non-bearish reasons.
    # =========================================================
    insider_score = 50
    insider_details = []

    try:
        today = datetime.date.today()
        from_date = (today - datetime.timedelta(days=180)).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        insider_data = finnhub_get("stock/insider-transactions", {
            "symbol": ticker, "from": from_date, "to": to_date,
        })
        if insider_data and insider_data.get("data"):
            buy_val = 0
            sell_val = 0
            for item in insider_data["data"]:
                if item.get("isDerivative", False):
                    continue
                code = item.get("transactionCode", "")
                change = item.get("change", 0)
                price = item.get("transactionPrice", 0)
                val = abs(change * price) if price else 0
                if code == "P":
                    buy_val += val
                elif code == "S":
                    sell_val += val

            total_insider = buy_val + sell_val
            if total_insider > 0:
                buy_ratio = buy_val / total_insider

                if buy_ratio > 0.6:
                    insider_score = 85
                    insider_details.append({
                        "name": "Insider Activity (6 months)",
                        "value": f"${buy_val / 1e6:.1f}M bought vs ${sell_val / 1e6:.1f}M sold",
                        "signal": "Buying",
                        "explanation": f"Insiders are putting their own money into the stock. This is one of the strongest long-term signals because these people see the company's internal numbers, upcoming products, and future plans. When a CEO buys millions in stock, they're betting their personal wealth on the company's future.",
                    })
                elif buy_ratio > 0.2:
                    insider_score = 55
                    insider_details.append({
                        "name": "Insider Activity (6 months)",
                        "value": f"${buy_val / 1e6:.1f}M bought, ${sell_val / 1e6:.1f}M sold",
                        "signal": "Mixed",
                        "explanation": f"Some insider buying and some selling. This is normal -- insiders sell to diversify, pay taxes, or buy a house. Only matters if it's heavily one-sided. Not a strong signal either way for long-term investors.",
                    })
                else:
                    insider_score = 35
                    insider_details.append({
                        "name": "Insider Activity (6 months)",
                        "value": f"${sell_val / 1e6:.1f}M sold, ${buy_val / 1e6:.1f}M bought",
                        "signal": "Selling",
                        "explanation": f"Insiders are mostly selling. IMPORTANT CONTEXT: This alone is NOT a strong sell signal. Most large-cap CEOs sell regularly through pre-scheduled plans (called 10b5-1 plans) for tax purposes and diversification. Jensen Huang (NVIDIA CEO) has sold stock every quarter for years while the stock went up 10x. Insider selling only matters if the company's fundamentals are also deteriorating.",
                    })
            else:
                insider_score = 50
                insider_details.append({
                    "name": "Insider Activity (6 months)",
                    "value": "No significant activity",
                    "signal": "Neutral",
                    "explanation": "No major insider buying or selling in the last 6 months. This is neither good nor bad.",
                })
        else:
            insider_details.append({
                "name": "Insider Activity", "value": "No data", "signal": "N/A",
                "explanation": "Insider transaction data is not available.",
            })
    except Exception:
        insider_details.append({
            "name": "Insider Activity", "value": "Error", "signal": "N/A",
            "explanation": "Could not retrieve insider data.",
        })

    factors.append({"category": "Insider Confidence", "score": insider_score, "weight": 10, "details": insider_details})

    # =========================================================
    # 5. PRICE & ENTRY POINT (weight: 10)
    #    Is now a good time to buy, even if the company is great?
    #    Low weight because for true long-term investors, timing matters less.
    # =========================================================
    entry_score = 50
    entry_details = []

    technicals = get_technicals(ticker)
    if technicals["source"] != "unavailable":
        rsi = technicals.get("rsi")
        ma50_pos = technicals.get("price_vs_ma50")
        ma200_pos = technicals.get("price_vs_ma200")
        ma50_val = technicals.get("ma50")
        ma200_val = technicals.get("ma200")
        sub_scores = []

        # Continuous MA scoring: how far below/above averages (in %)
        # For long-term: below MAs = better entry = higher score
        try:
            price_data_entry = get_realtime_price(ticker)
            current_price = price_data_entry.get("price", 0)
        except Exception:
            current_price = 0

        if current_price and ma50_val and ma200_val:
            # % distance from MA50 and MA200 (negative = below = good for entry)
            dist_ma50 = ((current_price - ma50_val) / ma50_val) * 100
            dist_ma200 = ((current_price - ma200_val) / ma200_val) * 100
            avg_dist = (dist_ma50 + dist_ma200) / 2

            # Scale: -15% below avg = 90 (great discount), at avg = 50, +15% above = 15 (overheated)
            ma_score = max(10, min(95, 50 - (avg_dist * 2.67)))

            if ma50_pos == "below" and ma200_pos == "below":
                signal = "Potential Discount"
                explanation = f"The stock is {abs(dist_ma50):.1f}% below its 50-day average (${ma50_val}) and {abs(dist_ma200):.1f}% below its 200-day average (${ma200_val}). For a long-term investor, buying below both averages means you're getting a relative discount. The deeper the discount on a quality company, the better your long-term returns tend to be."
            elif ma50_pos == "above" and ma200_pos == "above":
                signal = "Full Price"
                explanation = f"The stock is {dist_ma50:.1f}% above its 50-day average (${ma50_val}) and {dist_ma200:.1f}% above its 200-day average (${ma200_val}). You're paying a premium over recent averages. Not a dealbreaker for long-term, but waiting for a dip could improve your entry."
            else:
                signal = "Fair"
                explanation = f"Price is between its moving averages (MA50: ${ma50_val}, MA200: ${ma200_val}). Not a deep discount but not overheated. A reasonable entry for long-term investors."

            sub_scores.append(ma_score)
            entry_details.append({
                "name": "Entry Timing",
                "value": f"{'Below' if avg_dist < 0 else 'Above'} averages by {abs(avg_dist):.1f}%",
                "signal": signal,
                "explanation": explanation,
            })
        elif ma50_pos and ma200_pos:
            # Fallback if we can't compute distance
            if ma50_pos == "below" and ma200_pos == "below":
                sub_scores.append(68)
            elif ma50_pos == "above" and ma200_pos == "above":
                sub_scores.append(38)
            else:
                sub_scores.append(52)
            entry_details.append({
                "name": "Entry Timing",
                "value": f"MA50: {ma50_pos}, MA200: {ma200_pos}",
                "signal": "See technicals",
                "explanation": "Price position relative to moving averages suggests a moderate entry point.",
            })

        # Continuous RSI scoring (for long-term: lower RSI = better entry)
        # RSI 15 → score 90, RSI 30 → score 75, RSI 50 → score 50, RSI 70 → score 25, RSI 85 → score 10
        if rsi is not None:
            rsi_score = max(10, min(90, 90 - (rsi - 15) * (80 / 70)))
            sub_scores.append(rsi_score)

            if rsi < 25:
                signal = "Extreme Fear"
                explanation = f"RSI of {rsi:.0f} means intense selling pressure -- panic in the market. For a long-term investor in a quality company, this is historically one of the BEST entry points. The market overreacts emotionally. Think of it as a deep-discount sale."
            elif rsi < 35:
                signal = "Fear"
                explanation = f"RSI of {rsi:.0f} shows meaningful selling pressure. The stock is being sold off, which for a long-term investor in a solid company, creates a better entry price. Not extreme panic, but sentiment is clearly negative."
            elif rsi < 55:
                signal = "Normal"
                explanation = f"RSI of {rsi:.0f} -- balanced buying and selling. No extreme emotion in either direction. A perfectly fine time to buy if you like the company long-term."
            elif rsi < 70:
                signal = "Optimism"
                explanation = f"RSI of {rsi:.0f} shows buying momentum. The stock is trending up, which means you're paying a bit more. Consider whether you want to wait for a slight pullback or just buy and hold."
            else:
                signal = "Hype"
                explanation = f"RSI of {rsi:.0f} means everyone is piling in. The stock is likely overbought short-term. Even great companies frequently pull back 10-20% from these levels. Patience could save you 5-15% on your entry price."

            entry_details.append({
                "name": "Short-Term Sentiment",
                "value": f"RSI: {rsi:.0f} ({signal.lower()})",
                "signal": signal,
                "explanation": explanation,
            })

        if sub_scores:
            entry_score = sum(sub_scores) / len(sub_scores)

    factors.append({"category": "Price & Entry Point", "score": entry_score, "weight": 10, "details": entry_details})

    # =========================================================
    # COMPOSITE SCORE (weighted)
    # =========================================================
    total_weight = sum(f["weight"] for f in factors)
    composite = sum(f["score"] * f["weight"] for f in factors) / total_weight if total_weight > 0 else 50

    # Overall verdict -- long-term framing
    if composite >= 75:
        verdict_label = "STRONG LONG-TERM BUY"
        verdict_explanation = "This looks like a high-quality company with strong growth, good profitability, and professional backing. Short-term price swings don't change the fundamentals. If you can hold for 3-5+ years, this has the characteristics of a long-term wealth compounder."
    elif composite >= 62:
        verdict_label = "LONG-TERM BUY"
        verdict_explanation = "The business fundamentals are solid and growth prospects are positive. There may be some short-term headwinds, but the long-term picture is favorable. A good candidate for a buy-and-hold portfolio."
    elif composite >= 48:
        verdict_label = "HOLD / WATCH"
        verdict_explanation = "This stock has both strengths and weaknesses. The business isn't bad, but it's not compelling enough for a confident long-term bet. Consider watching it -- if the fundamentals improve or the price drops significantly, it could become a buy."
    elif composite >= 35:
        verdict_label = "CAUTION"
        verdict_explanation = "More warning signs than positive signals. The business faces challenges that could hurt long-term returns. Consider whether you have a strong thesis for why this company will turn things around."
    else:
        verdict_label = "AVOID"
        verdict_explanation = "Weak fundamentals, deteriorating growth, or poor business quality. Even if the stock is cheap, there's usually a reason. Long-term investors should look elsewhere for better opportunities."

    # Data confidence: how many factors had real data vs defaults
    factors_with_data = sum(1 for f in factors if len(f.get("details", [])) > 0)
    total_factors = len(factors)
    data_confidence = round((factors_with_data / total_factors) * 100) if total_factors > 0 else 0

    # Tag each factor with whether it has real data
    for f in factors:
        f["has_data"] = len(f.get("details", [])) > 0

    # Add warning if low confidence
    data_warnings = []
    for f in factors:
        if not f["has_data"]:
            data_warnings.append(f"No data available for '{f['category']}' -- score defaulted to neutral (50)")

    return _sanitize({
        "ticker": ticker,
        "composite_score": round(composite, 1),
        "verdict": verdict_label,
        "verdict_explanation": verdict_explanation,
        "factors": factors,
        "data_confidence": data_confidence,
        "data_warnings": data_warnings,
    })


def get_news_yfinance(ticker: str) -> list:
    """Fallback: get news from yfinance (works for EU stocks)."""
    try:
        t = yf.Ticker(ticker)
        raw = t.news or []
        news = []
        for item in raw[:8]:
            content = item.get("content", {})
            title = content.get("title", "")
            if not title:
                continue
            provider = content.get("provider", {})
            pub_date = content.get("pubDate", "")
            url = ""
            click = content.get("clickThroughUrl", {})
            if click:
                url = click.get("url", "")
            canonical = content.get("canonicalUrl", {})
            if not url and canonical:
                url = canonical.get("url", "")
            # Parse timestamp
            ts = 0
            if pub_date:
                try:
                    dt = datetime.datetime.fromisoformat(pub_date.replace("Z", "+00:00"))
                    ts = int(dt.timestamp())
                except Exception:
                    pass
            summary = content.get("summary", "")
            news.append({
                "headline": title,
                "source": provider.get("displayName", "Yahoo Finance"),
                "url": url,
                "datetime": ts,
                "summary": summary[:300] if summary else "",
            })
        return news
    except Exception:
        return []


def get_news_google_rss(query: str) -> list:
    """Scrape Google News RSS for a company/ticker."""
    try:
        import xml.etree.ElementTree as ET
        import html
        import re
        url = f"https://news.google.com/rss/search?q={requests.utils.quote(query + ' stock')}&hl=en&gl=US&ceid=US:en"
        resp = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200:
            return []

        root = ET.fromstring(resp.content)
        news = []
        for item in root.findall(".//item")[:10]:
            title_el = item.find("title")
            link_el = item.find("link")
            pub_el = item.find("pubDate")
            source_el = item.find("source")

            title = html.unescape(title_el.text) if title_el is not None and title_el.text else ""
            link = link_el.text if link_el is not None and link_el.text else ""
            source = source_el.text if source_el is not None and source_el.text else "Google News"

            # Parse pubDate (format: "Wed, 26 Mar 2026 14:30:00 GMT")
            ts = 0
            if pub_el is not None and pub_el.text:
                try:
                    from email.utils import parsedate_to_datetime
                    dt = parsedate_to_datetime(pub_el.text)
                    ts = int(dt.timestamp())
                except Exception:
                    pass

            if title:
                news.append({
                    "headline": title,
                    "source": source,
                    "url": link,
                    "datetime": ts,
                    "summary": "",
                })
        return news
    except Exception:
        return []


@app.get("/news/{ticker}")
def news_endpoint(ticker: str):
    ticker = resolve_ticker(ticker)

    all_news = []
    seen_headlines = set()

    def _add_unique(articles):
        for a in articles:
            # Deduplicate by headline similarity (first 50 chars lowercase)
            key = a["headline"][:50].lower().strip()
            if key not in seen_headlines:
                seen_headlines.add(key)
                all_news.append(a)

    # Source 1: Finnhub (US stocks, high quality)
    _add_unique(get_news(ticker))

    # Source 2: yfinance/Yahoo Finance (works for EU too, has summaries)
    _add_unique(get_news_yfinance(ticker))

    # Source 3: Google News RSS (broadest coverage, any stock)
    # Use company name if available for better results
    try:
        t = yf.Ticker(ticker)
        company_name = (t.info or {}).get("shortName", ticker)
    except Exception:
        company_name = ticker
    _add_unique(get_news_google_rss(company_name))

    # Sort by timestamp (newest first)
    all_news.sort(key=lambda x: x.get("datetime", 0), reverse=True)

    # Limit to 15 articles
    all_news = all_news[:15]

    sentiment = get_sentiment(ticker)

    return _sanitize({
        "ticker": ticker,
        "news": all_news,
        "sentiment": sentiment,
    })


@app.get("/short-term/{ticker}")
def short_term_verdict(ticker: str):
    """
    Short-term trading signal (1-4 weeks horizon).
    Weights: Momentum 25%, Technicals 25%, Volume 15%, News Catalyst 15%, Analyst Short-term 20%.
    """
    ticker = resolve_ticker(ticker)

    factors = []

    # =========================================================
    # 1. PRICE MOMENTUM (weight: 25)
    # =========================================================
    momentum_score = 50
    momentum_details = []

    try:
        t = yf.Ticker(ticker)
        hist = t.history(period="3mo")
        if not hist.empty and len(hist) >= 20:
            closes = hist["Close"].values
            current = float(closes[-1])

            # 5-day return
            if len(closes) >= 6:
                ret_5d = ((current - float(closes[-6])) / float(closes[-6])) * 100
                if ret_5d > 5:
                    s = min(90, 70 + ret_5d)
                    momentum_details.append({"name": "5-Day Move", "value": f"{ret_5d:+.1f}%",
                        "signal": "Strong Rally", "explanation": f"The stock gained {ret_5d:.1f}% in 5 days — strong upward momentum. This often continues short-term but watch for exhaustion."})
                elif ret_5d > 1:
                    s = 60 + ret_5d * 2
                    momentum_details.append({"name": "5-Day Move", "value": f"{ret_5d:+.1f}%",
                        "signal": "Positive", "explanation": f"Modest gains of {ret_5d:.1f}% over 5 days — the trend is gently upward."})
                elif ret_5d > -1:
                    s = 50
                    momentum_details.append({"name": "5-Day Move", "value": f"{ret_5d:+.1f}%",
                        "signal": "Flat", "explanation": f"Essentially flat over 5 days ({ret_5d:+.1f}%). No strong direction — wait for a catalyst."})
                elif ret_5d > -5:
                    s = 40 + ret_5d * 2
                    momentum_details.append({"name": "5-Day Move", "value": f"{ret_5d:+.1f}%",
                        "signal": "Weak", "explanation": f"Down {abs(ret_5d):.1f}% in 5 days — some selling pressure. Could bounce or continue lower."})
                else:
                    s = max(10, 30 + ret_5d)
                    momentum_details.append({"name": "5-Day Move", "value": f"{ret_5d:+.1f}%",
                        "signal": "Selloff", "explanation": f"Dropped {abs(ret_5d):.1f}% in just 5 days — significant selling. Check news for the catalyst."})
                momentum_score = s

            # 20-day return
            if len(closes) >= 21:
                ret_20d = ((current - float(closes[-21])) / float(closes[-21])) * 100
                if ret_20d > 10:
                    m20_s = 80
                    signal = "Strong Uptrend"
                elif ret_20d > 3:
                    m20_s = 65
                    signal = "Uptrend"
                elif ret_20d > -3:
                    m20_s = 50
                    signal = "Sideways"
                elif ret_20d > -10:
                    m20_s = 35
                    signal = "Downtrend"
                else:
                    m20_s = 20
                    signal = "Strong Downtrend"
                momentum_details.append({"name": "20-Day Trend", "value": f"{ret_20d:+.1f}%",
                    "signal": signal, "explanation": f"Over the past month, the stock moved {ret_20d:+.1f}%. This gives context to whether the 5-day move is part of a larger trend or a reversal."})
                momentum_score = (momentum_score + m20_s) / 2
    except Exception:
        pass

    factors.append({"category": "Price Momentum", "score": round(momentum_score, 0), "weight": 25, "details": momentum_details})

    # =========================================================
    # 2. TECHNICALS / RSI + MA (weight: 25)
    # =========================================================
    tech_score = 50
    tech_details = []

    technicals = get_technicals(ticker)
    if technicals["source"] != "unavailable":
        rsi = technicals.get("rsi")
        ma50_pos = technicals.get("price_vs_ma50")
        ma200_pos = technicals.get("price_vs_ma200")

        # RSI for short-term: oversold = buy signal, overbought = sell signal
        if rsi is not None:
            if rsi < 25:
                rsi_s = 85
                signal = "Extremely Oversold"
                expl = f"RSI at {rsi:.0f} — extreme oversold territory. Historically, stocks bounce hard from these levels within 1-2 weeks. High probability of a short-term rally."
            elif rsi < 35:
                rsi_s = 70
                signal = "Oversold"
                expl = f"RSI at {rsi:.0f} — oversold. Selling pressure is fading and a bounce is likely within days to a week."
            elif rsi < 55:
                rsi_s = 50
                signal = "Neutral"
                expl = f"RSI at {rsi:.0f} — balanced. No extreme in either direction. The stock could go either way short-term."
            elif rsi < 70:
                rsi_s = 35
                signal = "Overbought Warning"
                expl = f"RSI at {rsi:.0f} — getting warm. Momentum is strong but a pullback could come anytime. Careful with new entries."
            else:
                rsi_s = 15
                signal = "Overbought"
                expl = f"RSI at {rsi:.0f} — overbought. The stock has run too far too fast. High risk of a short-term pullback of 5-15%."
            tech_details.append({"name": "RSI Signal", "value": f"{rsi:.0f}", "signal": signal, "explanation": expl})
            tech_score = rsi_s

        # MA cross signals
        if ma50_pos == "above" and ma200_pos == "above":
            ma_s = 65
            tech_details.append({"name": "Moving Averages", "value": "Above both MA50 & MA200",
                "signal": "Bullish Structure", "explanation": "Price is above both key averages — the trend is up. Short-term traders want to buy dips in this structure, not fight the trend."})
        elif ma50_pos == "below" and ma200_pos == "below":
            ma_s = 30
            tech_details.append({"name": "Moving Averages", "value": "Below both MA50 & MA200",
                "signal": "Bearish Structure", "explanation": "Price is below both key averages — the trend is down. Short-term rallies tend to fail. Only trade bounces with tight stops."})
        elif ma50_pos == "above":
            ma_s = 55
            tech_details.append({"name": "Moving Averages", "value": "Above MA50, below MA200",
                "signal": "Recovery", "explanation": "Price reclaimed the short-term average but not the long-term one. Could be the start of a reversal or just a dead cat bounce."})
        else:
            ma_s = 40
            tech_details.append({"name": "Moving Averages", "value": "Below MA50, above MA200",
                "signal": "Weakening", "explanation": "Lost the short-term average but still above long-term support. A critical level — if MA200 breaks, expect acceleration down."})
        tech_score = (tech_score + ma_s) / 2

    factors.append({"category": "Technical Setup", "score": round(tech_score, 0), "weight": 25, "details": tech_details})

    # =========================================================
    # 3. VOLUME SIGNAL (weight: 15)
    # =========================================================
    vol_score = 50
    vol_details = []

    try:
        t = yf.Ticker(ticker)
        hist = t.history(period="3mo")
        if not hist.empty and len(hist) >= 20:
            volumes = hist["Volume"].values
            closes = hist["Close"].values
            avg_vol_20 = float(np.mean(volumes[-20:]))
            recent_vol = float(np.mean(volumes[-3:]))
            last_close_change = (float(closes[-1]) - float(closes[-2])) / float(closes[-2]) * 100

            if avg_vol_20 > 0:
                vol_ratio = recent_vol / avg_vol_20

                if vol_ratio > 2.0 and last_close_change > 0:
                    vol_score = 80
                    vol_details.append({"name": "Volume Surge", "value": f"{vol_ratio:.1f}x avg volume",
                        "signal": "Buying Frenzy", "explanation": f"Volume is {vol_ratio:.1f}x above normal AND the price is up. Big buyers are stepping in — institutions or news-driven demand. This often signals the start of a move."})
                elif vol_ratio > 2.0 and last_close_change < 0:
                    vol_score = 20
                    vol_details.append({"name": "Volume Surge", "value": f"{vol_ratio:.1f}x avg volume",
                        "signal": "Panic Selling", "explanation": f"Volume is {vol_ratio:.1f}x above normal but the price is DOWN. Heavy selling — someone big is exiting. Often precedes more downside short-term."})
                elif vol_ratio > 1.3:
                    vol_score = 55 + (10 if last_close_change > 0 else -10)
                    vol_details.append({"name": "Volume", "value": f"{vol_ratio:.1f}x avg volume",
                        "signal": "Above Average", "explanation": f"Slightly elevated volume ({vol_ratio:.1f}x normal). More interest than usual but not a decisive signal on its own."})
                elif vol_ratio < 0.6:
                    vol_score = 45
                    vol_details.append({"name": "Volume", "value": f"{vol_ratio:.1f}x avg (low)",
                        "signal": "Low Interest", "explanation": f"Volume is {vol_ratio:.1f}x below average. No one's paying attention. Low-volume moves are unreliable — they can reverse quickly."})
                else:
                    vol_score = 50
                    vol_details.append({"name": "Volume", "value": f"{vol_ratio:.1f}x avg",
                        "signal": "Normal", "explanation": "Volume is in the normal range. No unusual buying or selling activity detected."})
    except Exception:
        pass

    factors.append({"category": "Volume Signal", "score": round(vol_score, 0), "weight": 15, "details": vol_details})

    # =========================================================
    # 4. NEWS CATALYST (weight: 15)
    # =========================================================
    news_score = 50
    news_details = []

    news_items = get_news(ticker)
    if not news_items:
        news_items = get_news_yfinance(ticker)

    if news_items and len(news_items) >= 3:
        news_score = 55
        news_details.append({"name": "News Activity", "value": f"{len(news_items)} recent articles",
            "signal": "Active Coverage", "explanation": f"Found {len(news_items)} recent news articles. Active news coverage means the stock is on traders' radar, which increases short-term volatility and potential catalysts."})
    elif news_items and len(news_items) >= 1:
        news_score = 50
        news_details.append({"name": "News Activity", "value": f"{len(news_items)} recent articles",
            "signal": "Some Coverage", "explanation": f"A few recent news items. Nothing overwhelming but the stock isn't completely forgotten."})
    else:
        news_score = 45
        news_details.append({"name": "News Activity", "value": "No recent news",
            "signal": "Quiet", "explanation": "No recent news coverage found. Without a catalyst, the stock is likely to drift sideways or follow the broader market."})

    factors.append({"category": "News Catalyst", "score": round(news_score, 0), "weight": 15, "details": news_details})

    # =========================================================
    # 5. ANALYST SHORT-TERM (weight: 20)
    # =========================================================
    analyst_score = 50
    analyst_details = []

    sentiment = get_sentiment(ticker)
    if sentiment["source"] != "unavailable" and sentiment["analysts_total"] > 0:
        score_raw = sentiment["score"]
        analyst_score = score_raw * 100  # 0-1 → 0-100
        total = sentiment["analysts_total"]
        sb = sentiment["strong_buy"]
        b = sentiment["buy"]
        h = sentiment["hold"]
        s = sentiment["sell"]
        ss = sentiment["strong_sell"]

        buy_pct = round(((sb + b) / total) * 100)
        sell_pct = round(((s + ss) / total) * 100)

        if buy_pct >= 70:
            signal = "Strong Consensus Buy"
            expl = f"{buy_pct}% of {total} analysts say Buy/Strong Buy. Overwhelming professional consensus supports upside. However, be aware that when everyone agrees, contrarian risk exists."
        elif buy_pct >= 50:
            signal = "Majority Buy"
            expl = f"{buy_pct}% of {total} analysts are bullish. Most pros see upside, but there's meaningful disagreement ({sell_pct}% say Sell). The bull case isn't unanimous."
        elif sell_pct >= 50:
            signal = "Majority Sell"
            expl = f"{sell_pct}% of {total} analysts say Sell. More than half the pros think this stock is going down. Take that seriously for short-term positioning."
        else:
            signal = "Mixed/Split"
            expl = f"Analysts are divided — {buy_pct}% Buy vs {sell_pct}% Sell. No clear consensus. The stock could go either way based on the next catalyst."

        analyst_details.append({"name": "Analyst Consensus", "value": f"{buy_pct}% Buy, {sell_pct}% Sell ({total} analysts)",
            "signal": signal, "explanation": expl})
    else:
        analyst_details.append({"name": "Analyst Coverage", "value": "No data",
            "signal": "N/A", "explanation": "No analyst recommendation data available for this stock."})

    factors.append({"category": "Analyst Consensus", "score": round(analyst_score, 0), "weight": 20, "details": analyst_details})

    # =========================================================
    # COMPOSITE
    # =========================================================
    total_weight = sum(f["weight"] for f in factors)
    composite = sum(f["score"] * f["weight"] for f in factors) / total_weight if total_weight > 0 else 50

    # Verdict labels (short-term oriented)
    if composite >= 72:
        verdict_label = "SHORT-TERM BUY"
        verdict_explanation = "Strong short-term setup. Momentum, technicals, and volume all point upward. If you're looking for a trade, the stars are aligned for the next 1-4 weeks."
    elif composite >= 60:
        verdict_label = "LEAN BULLISH"
        verdict_explanation = "More positive signals than negative. Not a screaming buy, but the short-term bias is to the upside. A small pullback could be a good entry."
    elif composite >= 45:
        verdict_label = "NEUTRAL / WAIT"
        verdict_explanation = "Mixed signals. No clear short-term direction. Better to wait for a catalyst, a breakout, or a clearer setup before committing capital."
    elif composite >= 32:
        verdict_label = "LEAN BEARISH"
        verdict_explanation = "More warning signs than positive signals. Momentum is fading or already negative. If you're holding, tighten your stops. Not a great time to add."
    else:
        verdict_label = "SHORT-TERM SELL"
        verdict_explanation = "Technical breakdown, heavy selling, and/or negative catalysts. Short-term pain is likely. If you're holding, consider reducing. If you're watching, wait for a bottom."

    # Data confidence
    factors_with_data = sum(1 for f in factors if len(f.get("details", [])) > 0)
    total_factors = len(factors)
    data_confidence = round((factors_with_data / total_factors) * 100) if total_factors > 0 else 0
    for f in factors:
        f["has_data"] = len(f.get("details", [])) > 0
    data_warnings = [f"No data for '{f['category']}' -- defaulted to neutral" for f in factors if not f["has_data"]]

    return _sanitize({
        "ticker": ticker,
        "composite_score": round(composite, 1),
        "verdict": verdict_label,
        "verdict_explanation": verdict_explanation,
        "factors": factors,
        "data_confidence": data_confidence,
        "data_warnings": data_warnings,
    })


# =============================================
# 6-MONTH VISION (CATALYST-DRIVEN)
# =============================================

# Sector catalysts — events that could drive sector-wide re-ratings
SECTOR_CATALYSTS = {
    "Space & Defense Tech": [
        {"event": "SpaceX / Starlink IPO", "date": "H2 2026", "impact": "very_high", "description": "Le plus gros IPO de l'histoire créera une vague d'intérêt massif pour tout le secteur spatial. Les comparables seront revalorisés par effet d'entraînement."},
        {"event": "Contrats Artemis NASA", "date": "2026", "impact": "high", "description": "Les attributions de contrats Artemis III/IV bénéficieront aux sous-traitants et partenaires du programme lunaire."},
        {"event": "Expansion constellation Starlink", "date": "Ongoing", "impact": "medium", "description": "La demande croissante en internet par satellite pousse les commandes de satellites et de lanceurs."},
    ],
    "Photonics & Optical": [
        {"event": "Déploiement 800G/1.6T Datacenter", "date": "2026-2027", "impact": "very_high", "description": "La transition vers les transceivers 800G et 1.6T pour les datacenters IA crée une demande explosive. Chaque cluster GPU nécessite des milliers de composants optiques."},
        {"event": "Expansion IA & GPU clusters", "date": "Ongoing", "impact": "very_high", "description": "Chaque dollar dépensé en GPU Nvidia génère ~$0.30-0.50 en composants optiques. Le marché des transceivers IA devrait tripler d'ici 2027."},
        {"event": "Consolidation sectorielle", "date": "2026", "impact": "medium", "description": "Des M&A sont attendues dans le secteur (Coherent a acquis II-VI, Lumentum a acquis NeoPhotonics). Les petits acteurs comme AAOI sont des cibles potentielles."},
    ],
    "AI Infrastructure": [
        {"event": "OpenAI / Anthropic IPOs", "date": "H2 2026", "impact": "high", "description": "Les IPOs des leaders IA valideront les valorisations du secteur et augmenteront l'attention des investisseurs retail."},
        {"event": "Dépenses IA hyperscalers", "date": "Ongoing", "impact": "very_high", "description": "Microsoft, Google, Amazon et Meta dépenseront $200B+ en infrastructure IA en 2026. Les fournisseurs de hardware et software bénéficient directement."},
    ],
    "Cybersecurity AI": [
        {"event": "Régulations IA & cybersécurité", "date": "2026", "impact": "high", "description": "Les nouvelles régulations sur la sécurité de l'IA et la protection des données augmentent les budgets cybersécurité des entreprises."},
    ],
    "Fintech Infrastructure": [
        {"event": "Stripe / Klarna IPOs", "date": "H1-H2 2026", "impact": "high", "description": "Les IPOs fintech fixeront de nouveaux benchmarks de valorisation pour les paiements digitaux et le BNPL."},
    ],
    "Robotics & Automation": [
        {"event": "Adoption robots chirurgicaux", "date": "Ongoing", "impact": "medium", "description": "La pénétration des robots chirurgicaux accélère dans les marchés émergents."},
    ],
    "Clean Energy & Grid": [
        {"event": "IRA & subventions énergie", "date": "2026", "impact": "medium", "description": "Les crédits d'impôt de l'Inflation Reduction Act continuent de soutenir les installations solaires et les bornes de recharge."},
    ],
    "Synthetic Biology & Genomics": [
        {"event": "Approbations FDA thérapies géniques", "date": "2026-2027", "impact": "high", "description": "Plusieurs thérapies CRISPR et base editing sont en phase III avec des résultats attendus en 2026."},
    ],
}


@app.get("/vision/{ticker}")
def six_month_vision(ticker: str):
    """
    6-month forward-looking analysis factoring in catalysts, sector momentum,
    comparable valuations, and event-driven potential.
    """
    ticker = resolve_ticker(ticker)

    # Gather data
    fundamentals = get_fundamentals(ticker)
    technicals = get_technicals(ticker)
    profile_data = get_company_profile(ticker)

    if not profile_data or not profile_data.get("name"):
        raise HTTPException(status_code=404, detail=f"Cannot analyze {ticker}")

    # Determine sector
    stock_sector = None
    for sector, tickers_list in SCREENER_SECTORS.items():
        if ticker in tickers_list:
            stock_sector = sector
            break

    # If not in screener, try to infer from industry
    if not stock_sector:
        industry = (profile_data.get("industry") or "").lower()
        if any(k in industry for k in ["semiconductor", "optical", "photon", "laser"]):
            stock_sector = "Photonics & Optical"
        elif any(k in industry for k in ["aerospace", "space", "satellite", "defense"]):
            stock_sector = "Space & Defense Tech"
        elif any(k in industry for k in ["cyber", "security"]):
            stock_sector = "Cybersecurity AI"
        elif any(k in industry for k in ["fintech", "payment", "bank"]):
            stock_sector = "Fintech Infrastructure"
        elif any(k in industry for k in ["software", "cloud", "ai", "artificial"]):
            stock_sector = "AI Infrastructure"

    # Get catalysts for the sector
    catalysts = SECTOR_CATALYSTS.get(stock_sector, []) if stock_sector else []

    # =============================================
    # COMPUTE 6-MONTH SCORES
    # =============================================

    factors = []

    # 1. MOMENTUM TRAJECTORY (weight: 20)
    momentum_score = 50
    momentum_detail = {}
    try:
        t = yf.Ticker(ticker)
        hist = t.history(period="6mo")
        if not hist.empty and len(hist) > 20:
            closes = hist["Close"].values
            # 1-month return
            ret_1m = ((closes[-1] - closes[-22]) / closes[-22] * 100) if len(closes) > 22 else 0
            # 3-month return
            ret_3m = ((closes[-1] - closes[-66]) / closes[-66] * 100) if len(closes) > 66 else 0
            # 6-month return
            ret_6m = ((closes[-1] - closes[0]) / closes[0] * 100)
            # Acceleration: is momentum increasing?
            acceleration = ret_1m - (ret_3m / 3) if ret_3m else 0

            momentum_detail = {
                "return_1m": round(ret_1m, 1),
                "return_3m": round(ret_3m, 1),
                "return_6m": round(ret_6m, 1),
                "acceleration": round(acceleration, 1),
            }

            if ret_1m > 15 and ret_3m > 30:
                momentum_score = 85
            elif ret_1m > 5 and ret_3m > 15:
                momentum_score = 72
            elif ret_1m > 0 and ret_3m > 0:
                momentum_score = 60
            elif ret_1m < -10:
                momentum_score = 30
            elif ret_1m < -5:
                momentum_score = 40
            else:
                momentum_score = 50

            # Boost for accelerating momentum
            if acceleration > 5:
                momentum_score = min(95, momentum_score + 10)
    except Exception:
        pass

    factors.append({
        "name": "Trajectoire Momentum",
        "weight": 20,
        "score": momentum_score,
        "detail": momentum_detail,
    })

    # 2. CATALYST PROXIMITY (weight: 25)
    catalyst_score = 40  # neutral if no catalysts
    catalyst_detail = []
    if catalysts:
        high_impact_count = sum(1 for c in catalysts if c["impact"] in ("very_high", "high"))
        if high_impact_count >= 2:
            catalyst_score = 85
        elif high_impact_count >= 1:
            catalyst_score = 70
        else:
            catalyst_score = 55
        catalyst_detail = catalysts

    factors.append({
        "name": "Catalyseurs Sectoriels",
        "weight": 25,
        "score": catalyst_score,
        "detail": catalyst_detail,
    })

    # 3. REVENUE GROWTH TRAJECTORY (weight: 20)
    growth_score = 50
    growth_detail = {}
    rev_growth = fundamentals.get("revenue_growth_yoy")
    if rev_growth is not None:
        growth_detail["revenue_growth_yoy"] = rev_growth
        if rev_growth > 50:
            growth_score = 90
            growth_detail["assessment"] = "Hyper-croissance — la demande explose"
        elif rev_growth > 25:
            growth_score = 75
            growth_detail["assessment"] = "Forte croissance — le business scale rapidement"
        elif rev_growth > 10:
            growth_score = 60
            growth_detail["assessment"] = "Croissance solide — expansion régulière"
        elif rev_growth > 0:
            growth_score = 45
            growth_detail["assessment"] = "Croissance modeste — pas de catalyseur de revenus évident"
        else:
            growth_score = 25
            growth_detail["assessment"] = "Revenus en déclin — risque fondamental"

    factors.append({
        "name": "Trajectoire Revenus",
        "weight": 20,
        "score": growth_score,
        "detail": growth_detail,
    })

    # 4. TECHNICAL SETUP (weight: 15)
    tech_score = 50
    tech_detail = {}
    rsi = technicals.get("rsi")
    ma50 = technicals.get("ma50")
    ma200 = technicals.get("ma200")
    if rsi is not None:
        tech_detail["rsi"] = rsi
        tech_detail["ma50_pos"] = technicals.get("price_vs_ma50")
        tech_detail["ma200_pos"] = technicals.get("price_vs_ma200")

        if technicals.get("price_vs_ma50") == "above" and technicals.get("price_vs_ma200") == "above":
            tech_score = 72
            if rsi > 70:
                tech_score = 60  # overbought risk
                tech_detail["warning"] = "RSI surachat — risque de pullback court terme"
            elif 40 < rsi < 60:
                tech_score = 78  # ideal zone
        elif technicals.get("price_vs_ma50") == "below" and technicals.get("price_vs_ma200") == "below":
            tech_score = 30
        elif technicals.get("price_vs_ma50") == "below":
            tech_score = 45  # pullback within uptrend
        else:
            tech_score = 55

    factors.append({
        "name": "Setup Technique",
        "weight": 15,
        "score": tech_score,
        "detail": tech_detail,
    })

    # 5. VALUATION RISK / REWARD (weight: 20)
    val_score = 50
    val_detail = {}

    pe = fundamentals.get("pe_ratio")
    fwd_pe = fundamentals.get("forward_pe")
    if pe is not None and fwd_pe is not None and fwd_pe > 0:
        pe_compression = ((pe - fwd_pe) / pe * 100) if pe > 0 else 0
        val_detail["pe"] = pe
        val_detail["forward_pe"] = fwd_pe
        val_detail["pe_compression"] = round(pe_compression, 1)

        if pe_compression > 20:
            val_score = 75
            val_detail["assessment"] = "Forte compression PE attendue — les earnings rattrapent la valorisation"
        elif pe_compression > 5:
            val_score = 62
            val_detail["assessment"] = "Compression PE modérée — valorisation en amélioration"
        elif pe < 20:
            val_score = 65
            val_detail["assessment"] = "Valorisation raisonnable — marge de sécurité présente"
        else:
            val_score = 45
            val_detail["assessment"] = "Valorisation tendue — peu de marge d'erreur"
    elif pe is None and rev_growth is not None and rev_growth > 30:
        # Pre-profit high growth (like FLY, PL, ASTS)
        val_score = 55
        val_detail["assessment"] = "Pre-profit mais forte croissance — valorisation basée sur le potentiel et les catalyseurs sectoriels"
        val_detail["note"] = "Pour les entreprises pre-profit dans des secteurs à catalyseur (SpaceX IPO, expansion IA), la valorisation se justifie par le momentum sectoriel plutôt que par les multiples traditionnels"
    elif pe is None:
        val_score = 40
        val_detail["assessment"] = "Pas de PE — entreprise non-profitable, valorisation spéculative"

    factors.append({
        "name": "Risque/Rendement Valorisation",
        "weight": 20,
        "score": val_score,
        "detail": val_detail,
    })

    # =============================================
    # COMPOSITE SCORE
    # =============================================
    total_weight = sum(f["weight"] for f in factors)
    composite = sum(f["score"] * f["weight"] for f in factors) / max(total_weight, 1)

    # Determine verdict
    if composite >= 75:
        verdict_label = "STRONG CONVICTION"
        verdict_color = "green"
        outlook = "Le momentum, les catalyseurs sectoriels et la trajectoire de croissance convergent positivement. Les 6 prochains mois offrent un potentiel de hausse significatif."
    elif composite >= 62:
        verdict_label = "FAVORABLE"
        verdict_color = "green"
        outlook = "Les conditions sont globalement positives avec des catalyseurs identifiés. Le risque/rendement penche en faveur de l'investisseur sur un horizon 6 mois."
    elif composite >= 50:
        verdict_label = "NEUTRE / ATTENDRE"
        verdict_color = "yellow"
        outlook = "Signaux mixtes. Des catalyseurs existent mais le timing ou la valorisation ne sont pas optimaux. Un pullback pourrait offrir un meilleur point d'entrée."
    elif composite >= 38:
        verdict_label = "PRUDENCE"
        verdict_color = "yellow"
        outlook = "Plus de risques que d'opportunités à court-moyen terme. Les catalyseurs sont insuffisants pour compenser les faiblesses fondamentales ou techniques."
    else:
        verdict_label = "ÉVITER"
        verdict_color = "red"
        outlook = "Les conditions sont défavorables sur un horizon 6 mois. Momentum négatif, pas de catalyseurs clairs, et/ou valorisation non justifiée."

    # Build entry analysis
    entry_analysis = ""
    if momentum_detail.get("return_3m", 0) > 50:
        entry_analysis = f"Le stock a déjà pris +{momentum_detail['return_3m']}% en 3 mois — l'entrée est plus coûteuse qu'il y a un trimestre. Cependant, "
    elif momentum_detail.get("return_3m", 0) > 20:
        entry_analysis = f"Hausse de +{momentum_detail['return_3m']}% sur 3 mois — le momentum est établi. "

    if catalysts:
        high_catalysts = [c for c in catalysts if c["impact"] in ("very_high", "high")]
        if high_catalysts:
            entry_analysis += f"Les catalyseurs majeurs à venir ({', '.join(c['event'] for c in high_catalysts[:2])}) peuvent amplifier le mouvement. "
            if momentum_detail.get("return_3m", 0) > 30:
                entry_analysis += "Même si l'entrée est plus chère qu'il y a quelques mois, le potentiel haussier lié aux catalyseurs sectoriels peut encore doubler la mise. Un investisseur avec un horizon de 6-12 mois et une tolérance au risque élevée peut considérer une position, idéalement en scaling progressif plutôt qu'en all-in."
            else:
                entry_analysis += "Le positionnement avant ces événements offre un avantage asymétrique — le downside est limité par le momentum sectoriel tandis que l'upside est amplifié par l'effet catalyseur."

    if not entry_analysis:
        if composite >= 62:
            entry_analysis = "Les conditions sont favorables pour initier une position sur cet horizon. Privilégiez un scaling progressif pour optimiser votre prix moyen d'entrée."
        elif composite >= 50:
            entry_analysis = "L'entrée est possible mais pas urgente. Attendez un pullback technique vers les supports (MA50 ou -10% des niveaux actuels) pour un meilleur point d'entrée."
        else:
            entry_analysis = "Les conditions ne sont pas optimales pour une entrée. Attendez une amélioration du momentum ou un catalyseur clair avant de vous positionner."

    return _sanitize({
        "ticker": ticker,
        "name": profile_data.get("name", ticker),
        "sector": stock_sector or "Non classifié",
        "horizon": "6 mois",
        "composite_score": round(composite, 1),
        "verdict": verdict_label,
        "verdict_color": verdict_color,
        "outlook": outlook,
        "entry_analysis": entry_analysis,
        "factors": factors,
        "catalysts": catalysts,
    })


@app.get("/portfolio")
def get_portfolio():
    return {"positions": list(portfolio.values())}


@app.post("/portfolio")
def add_position(pos: PortfolioPosition):
    ticker = pos.ticker.upper().strip()
    portfolio[ticker] = {
        "ticker": ticker,
        "shares": pos.shares,
        "avg_price": pos.avg_price,
    }
    return {"status": "ok", "position": portfolio[ticker]}


@app.delete("/portfolio/{ticker}")
def remove_position(ticker: str):
    ticker = ticker.upper().strip()
    if ticker in portfolio:
        del portfolio[ticker]
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Position not found")


@app.get("/portfolio/pnl")
def portfolio_pnl():
    results = []
    total_value = 0
    total_cost = 0

    for ticker, pos in portfolio.items():
        price_data = get_realtime_price(ticker)
        current_price = price_data.get("price", 0)
        cost = pos["shares"] * pos["avg_price"]
        value = pos["shares"] * current_price
        pnl = value - cost
        pnl_pct = ((current_price - pos["avg_price"]) / pos["avg_price"] * 100) if pos["avg_price"] > 0 else 0

        total_value += value
        total_cost += cost

        results.append({
            "ticker": ticker,
            "shares": pos["shares"],
            "avg_price": pos["avg_price"],
            "current_price": current_price,
            "value": round(value, 2),
            "cost": round(cost, 2),
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 1),
            "allocation_pct": 0,  # filled below
        })

    # Compute allocation percentages
    if total_value > 0:
        for r in results:
            r["allocation_pct"] = round(r["value"] / total_value * 100, 1)

    return {
        "positions": results,
        "total_value": round(total_value, 2),
        "total_cost": round(total_cost, 2),
        "total_pnl": round(total_value - total_cost, 2),
        "total_pnl_pct": round(((total_value - total_cost) / total_cost * 100) if total_cost > 0 else 0, 1),
    }


@app.get("/insiders/{ticker}")
def insider_transactions(ticker: str):
    """Get insider transactions from Finnhub (last 6 months)."""
    ticker = resolve_ticker(ticker)

    # Fetch last 6 months of insider transactions
    today = datetime.date.today()
    from_date = (today - datetime.timedelta(days=180)).strftime("%Y-%m-%d")
    to_date = today.strftime("%Y-%m-%d")

    data = finnhub_get("stock/insider-transactions", {
        "symbol": ticker,
        "from": from_date,
        "to": to_date,
    })
    if not data or not data.get("data"):
        return {"ticker": ticker, "transactions": [], "summary": {}}

    transactions = []
    seen = set()
    for item in data["data"]:
        # Only non-derivative transactions (actual stock buys/sells)
        if item.get("isDerivative", False):
            continue

        change = item.get("change", 0)
        price = item.get("transactionPrice", 0)
        name = item.get("name", "Unknown")
        date = item.get("transactionDate", "")
        code = item.get("transactionCode", "")

        # Deduplicate by name+date+change
        key = f"{name}:{date}:{change}"
        if key in seen:
            continue
        seen.add(key)

        # Only BUY and SELL (skip exercises, tax withholding, etc.)
        if code == "P":
            tx_type = "BUY"
        elif code == "S":
            tx_type = "SELL"
        else:
            continue

        value = abs(change * price) if price else 0

        transactions.append({
            "name": name,
            "type": tx_type,
            "shares": change,
            "price": round(price, 2) if price else None,
            "value": round(value, 2),
            "date": date,
            "filing_date": item.get("filingDate", ""),
        })

    # Sort by date descending
    transactions.sort(key=lambda x: x["date"], reverse=True)

    # Compute summary by insider
    insider_summary = {}
    for tx in transactions:
        name = tx["name"]
        if name not in insider_summary:
            insider_summary[name] = {"name": name, "buy_value": 0, "sell_value": 0, "buy_shares": 0, "sell_shares": 0, "tx_count": 0}
        insider_summary[name]["tx_count"] += 1
        if tx["type"] == "BUY":
            insider_summary[name]["buy_value"] += tx["value"]
            insider_summary[name]["buy_shares"] += abs(tx["shares"])
        else:
            insider_summary[name]["sell_value"] += tx["value"]
            insider_summary[name]["sell_shares"] += abs(tx["shares"])

    # Sort summary by total value (sells + buys)
    summary_list = sorted(insider_summary.values(), key=lambda x: x["sell_value"] + x["buy_value"], reverse=True)

    total_buy_value = sum(s["buy_value"] for s in summary_list)
    total_sell_value = sum(s["sell_value"] for s in summary_list)

    return {
        "ticker": ticker,
        "transactions": transactions,
        "summary": {
            "by_insider": summary_list[:10],
            "total_buy_value": round(total_buy_value, 2),
            "total_sell_value": round(total_sell_value, 2),
            "total_transactions": len(transactions),
            "period_from": from_date,
            "period_to": to_date,
        },
    }


@app.get("/earnings/{ticker}")
def earnings_data(ticker: str):
    """Get earnings history and next earnings date from Finnhub + yfinance."""
    ticker = resolve_ticker(ticker)

    # --- Earnings history: merge Finnhub + yfinance for max coverage ---
    earnings_history = []
    seen_periods = set()

    # 1) Finnhub earnings (usually 4 quarters)
    history = finnhub_get("stock/earnings", {"symbol": ticker})
    if history and isinstance(history, list):
        for item in history:
            period = item.get("period", "")
            if period in seen_periods:
                continue
            seen_periods.add(period)
            earnings_history.append({
                "period": period,
                "quarter": item.get("quarter"),
                "year": item.get("year"),
                "actual": item.get("actual"),
                "estimate": item.get("estimate"),
                "surprise": item.get("surprise"),
                "surprise_pct": item.get("surprisePercent"),
                "source": "finnhub",
            })

    # 2) yfinance earnings_history (may have different/additional quarters)
    # Deduplicate by matching actual EPS values (since dates differ between sources)
    existing_actuals = set()
    for e in earnings_history:
        if e["actual"] is not None:
            existing_actuals.add(round(e["actual"], 2))

    try:
        t = yf.Ticker(ticker)
        eh = t.earnings_history
        if eh is not None and not eh.empty:
            for idx, row in eh.iterrows():
                actual = float(row.get("epsActual")) if row.get("epsActual") is not None else None
                # Skip if we already have this earnings report (same actual EPS)
                if actual is not None and round(actual, 2) in existing_actuals:
                    continue

                report_date = str(idx.date()) if hasattr(idx, 'date') else str(idx)
                estimate = float(row.get("epsEstimate")) if row.get("epsEstimate") is not None else None
                surprise_pct = float(row.get("surprisePercent")) * 100 if row.get("surprisePercent") is not None else None
                surprise = float(row.get("epsDifference")) if row.get("epsDifference") is not None else None

                month = idx.month if hasattr(idx, 'month') else None
                quarter = ((month - 1) // 3 + 1) if month else None

                if actual is not None:
                    existing_actuals.add(round(actual, 2))

                earnings_history.append({
                    "period": report_date,
                    "quarter": quarter,
                    "year": idx.year if hasattr(idx, 'year') else None,
                    "actual": actual,
                    "estimate": estimate,
                    "surprise": surprise,
                    "surprise_pct": surprise_pct,
                    "source": "yfinance",
                })
    except Exception:
        pass

    # Sort by period descending, keep up to 8 most recent
    earnings_history.sort(key=lambda x: x["period"], reverse=True)
    earnings_history = earnings_history[:8]

    # Earnings calendar (next earnings)
    calendar = finnhub_get("calendar/earnings", {"symbol": ticker})
    next_earnings = None
    if calendar and calendar.get("earningsCalendar"):
        for entry in calendar["earningsCalendar"]:
            ed = entry.get("date", "")
            if ed:
                try:
                    edate = datetime.datetime.strptime(ed, "%Y-%m-%d").date()
                    today = datetime.date.today()
                    if edate >= today:
                        days_until = (edate - today).days
                        next_earnings = {
                            "date": ed,
                            "days_until": days_until,
                            "hour": entry.get("hour", ""),
                            "eps_estimate": entry.get("epsEstimate"),
                            "revenue_estimate": entry.get("revenueEstimate"),
                        }
                except ValueError:
                    pass

    # If no future earnings found, check yfinance
    if not next_earnings:
        try:
            t = yf.Ticker(ticker)
            cal = t.calendar
            if cal is not None and hasattr(cal, 'get'):
                ed = cal.get("Earnings Date")
                if ed and len(ed) > 0:
                    edate = ed[0].date() if hasattr(ed[0], 'date') else ed[0]
                    today = datetime.date.today()
                    days_until = (edate - today).days
                    if days_until >= 0:
                        next_earnings = {
                            "date": str(edate),
                            "days_until": days_until,
                            "hour": "",
                            "eps_estimate": None,
                            "revenue_estimate": None,
                        }
        except Exception:
            pass

    return {
        "ticker": ticker,
        "history": earnings_history,
        "next_earnings": next_earnings,
    }


# Manual peer overrides for sectors where Finnhub returns bad peers
PEER_OVERRIDES = {
    # Photonics / Optical
    "AAOI": ["LITE", "COHR", "IIVI", "VIAV", "CIEN"],
    "LITE": ["AAOI", "COHR", "VIAV", "CIEN", "FNSR"],
    "COHR": ["LITE", "AAOI", "VIAV", "IIVI", "CIEN"],
    "VIAV": ["LITE", "COHR", "AAOI", "CIEN", "IIVI"],
    "CIEN": ["LITE", "AAOI", "COHR", "VIAV", "ANET"],
    # Space & Satellites
    "PL": ["RKLB", "ASTS", "LUNR", "BKSY", "MNTS"],
    "RKLB": ["PL", "ASTS", "LUNR", "BKSY", "ASTR"],
    "ASTS": ["PL", "RKLB", "LUNR", "BKSY", "GSAT"],
    "LUNR": ["PL", "RKLB", "ASTS", "BKSY", "MNTS"],
    "BKSY": ["PL", "RKLB", "ASTS", "LUNR", "MNTS"],
    "FLY": ["RKLB", "PL", "ASTS", "LUNR", "BKSY"],
    # Quantum Computing
    "IONQ": ["RGTI", "QBTS", "QUBT", "ARQQ"],
    "RGTI": ["IONQ", "QBTS", "QUBT", "ARQQ"],
    "QBTS": ["IONQ", "RGTI", "QUBT", "ARQQ"],
    # Robotics
    "ISRG": ["TER", "IRBT", "AVAV", "PATH"],
    # Cybersecurity
    "CRWD": ["S", "ZS", "PANW", "FTNT", "RBRK"],
    "S": ["CRWD", "ZS", "PANW", "FTNT", "RBRK"],
}


@app.get("/peers/{ticker}")
def peer_comparison(ticker: str):
    """Get peer comparison data."""
    ticker = resolve_ticker(ticker)

    # Check manual overrides first
    if ticker in PEER_OVERRIDES:
        peers_list = PEER_OVERRIDES[ticker][:5]
    else:
        # Get peers from Finnhub
        peers_data = finnhub_get("stock/peers", {"symbol": ticker})
        if not peers_data or not isinstance(peers_data, list):
            return {"ticker": ticker, "peers": []}

        # Remove self and duplicates, limit to 5 peers
        peers_list = []
        seen = {ticker}
        for p in peers_data:
            if p not in seen and "." not in p:
                seen.add(p)
                peers_list.append(p)
            if len(peers_list) >= 5:
                break

    # Fetch key metrics for each peer (and self)
    all_tickers = [ticker] + peers_list
    results = []

    for t in all_tickers:
        try:
            yft = yf.Ticker(t)
            info = yft.info or {}

            price = info.get("currentPrice") or info.get("regularMarketPrice")
            change_pct = None
            prev_close = info.get("previousClose") or info.get("regularMarketPreviousClose")
            if price and prev_close and prev_close > 0:
                change_pct = round((price - prev_close) / prev_close * 100, 1)

            mcap = info.get("marketCap")
            pe = _safe_float(info.get("trailingPE"))
            fwd_pe = _safe_float(info.get("forwardPE"))
            rev_growth = _pct(info.get("revenueGrowth"))
            gross_margin = _pct(info.get("grossMargins"))
            op_margin = _pct(info.get("operatingMargins"))

            # Quick RSI
            hist = yft.history(period="3mo")
            rsi_val = None
            if not hist.empty and len(hist) >= 15:
                rsi_val = round(compute_rsi(hist["Close"].values, 14) or 0, 1)

            results.append({
                "ticker": t,
                "name": info.get("shortName", t),
                "price": round(float(price), 2) if price else None,
                "change_pct": change_pct,
                "market_cap": mcap,
                "pe_ratio": pe,
                "forward_pe": fwd_pe,
                "revenue_growth": rev_growth,
                "gross_margin": gross_margin,
                "operating_margin": op_margin,
                "rsi": rsi_val,
                "is_target": t == ticker,
            })
        except Exception:
            results.append({
                "ticker": t,
                "name": t,
                "price": None,
                "change_pct": None,
                "market_cap": None,
                "pe_ratio": None,
                "forward_pe": None,
                "revenue_growth": None,
                "gross_margin": None,
                "operating_margin": None,
                "rsi": None,
                "is_target": t == ticker,
            })

    return {"ticker": ticker, "peers": results}


# =========================================================
# RANKINGS — Pre-computed top stocks
# =========================================================

RANKINGS_UNIVERSE = [
    # ===== US TECH (30) =====
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "NFLX", "AMD", "CRM",
    "AVGO", "ORCL", "ADBE", "INTC", "QCOM", "MU", "PLTR", "SNOW", "SHOP", "SQ",
    "UBER", "COIN", "RBLX", "PANW", "CRWD", "DDOG", "ZS", "NET", "MRVL", "ON",
    # ===== US FINANCE (15) =====
    "JPM", "V", "MA", "BAC", "GS", "MS", "BLK", "SCHW", "AXP", "C",
    "WFC", "USB", "PNC", "BX", "KKR",
    # ===== US HEALTH (15) =====
    "UNH", "JNJ", "PFE", "LLY", "ABBV", "MRK", "TMO", "ABT", "AMGN", "BMY",
    "GILD", "ISRG", "VRTX", "REGN", "MDT",
    # ===== US INDUSTRIAL / ENERGY (20) =====
    "XOM", "CVX", "BA", "CAT", "GE", "RTX", "LMT", "HON", "UPS", "DE",
    "MMM", "GD", "NOC", "FDX", "EMR", "SLB", "COP", "PSX", "OXY", "VLO",
    # ===== US CONSUMER (15) =====
    "KO", "PEP", "MCD", "NKE", "SBUX", "DIS", "WMT", "COST", "HD", "TGT",
    "LOW", "ABNB", "MAR", "CMG", "YUM",
    # ===== US REAL ESTATE / UTILITIES (10) =====
    "AMT", "PLD", "CCI", "SPG", "O", "NEE", "DUK", "SO", "D", "AEP",
    # ===== US OTHER NOTABLE (10) =====
    "BRK-B", "T", "VZ", "PYPL", "ROKU", "SNAP", "PINS", "HOOD", "SOFI", "RIVN",
    # ===== FRANCE — CAC 40 + MID (25) =====
    "MC.PA", "RMS.PA", "AIR.PA", "SAF.PA", "SU.PA", "TTE.PA", "STM.PA", "DSY.PA",
    "CAP.PA", "BNP.PA", "OR.PA", "KER.PA", "DG.PA", "SAN.PA", "RI.PA", "GLE.PA",
    "HO.PA", "EL.PA", "ACA.PA", "ML.PA", "SGO.PA", "PUB.PA", "BIM.PA", "EDEN.PA",
    "FGR.PA",
    # ===== FRANCE — SMALL/MID TECH (10) =====
    "SOI.PA", "EXA.PA", "EXENS.PA", "OVH.PA", "AM.PA", "SOP.PA", "UBI.PA",
    "ATO.PA", "DIM.PA", "AKE.PA",
    # ===== GERMANY — DAX (20) =====
    "SAP.DE", "SIE.DE", "ALV.DE", "RHM.DE", "ADS.DE", "BMW.DE", "MBG.DE",
    "DTE.DE", "IFX.DE", "MUV2.DE", "BAS.DE", "BAYN.DE", "DBK.DE", "DHL.DE",
    "ENR.DE", "SHL.DE", "VOW3.DE", "EOAN.DE", "RWE.DE", "ZAL.DE",
    # ===== NETHERLANDS (12) =====
    "ASML.AS", "SHEL.AS", "UNA.AS", "PHIA.AS", "INGA.AS", "HEIA.AS",
    "PRX.AS", "WKL.AS", "ADYEN.AS", "BESI.AS", "ASM.AS", "MT.AS",
    # ===== ITALY (10) =====
    "RACE.MI", "ENEL.MI", "ENI.MI", "ISP.MI", "UCG.MI", "MONC.MI",
    "LDO.MI", "BC.MI", "PRY.MI", "FBK.MI",
    # ===== SPAIN (8) =====
    "ITX.MC", "SAN.MC", "BBVA.MC", "IBE.MC", "TEF.MC", "AMS.MC", "FER.MC", "CLNX.MC",
    # ===== BELGIUM (5) =====
    "ABI.BR", "UCB.BR", "KBC.BR", "SOF.BR", "MELE.BR",
    # ===== NORDICS (15) =====
    "NOVO-B.CO", "VWS.CO", "ORSTED.CO", "DSV.CO", "GMAB.CO",
    "NOKIA.HE", "KNEBV.HE", "NESTE.HE", "SAMPO.HE", "FORTUM.HE",
    "ERIC-B.ST", "VOLV-B.ST", "ATCO-A.ST", "EVO.ST", "HM-B.ST",
    # ===== SWITZERLAND (8) =====
    "NESN.SW", "NOVN.SW", "ROG.SW", "UBSG.SW", "CFR.SW", "LONN.SW", "GIVN.SW", "ZURN.SW",
    # ===== PORTUGAL + IRELAND (4) =====
    "EDP.LS", "GALP.LS", "RYA.IR", "CRH.L",
]

# Cache
_rankings_cache: Dict[str, Any] = {
    "long_term": [],
    "short_term": [],
    "last_updated": None,
    "computing": False,
}


def _compute_single_score(ticker: str) -> dict:
    """Compute both long-term and short-term scores for a single ticker. Lightweight."""
    result = {
        "ticker": ticker,
        "name": "",
        "price": None,
        "change_pct": None,
        "currency": "USD",
        "long_term_score": None,
        "long_term_verdict": "",
        "short_term_score": None,
        "short_term_verdict": "",
        "pe_ratio": None,
        "revenue_growth": None,
        "rsi": None,
    }

    try:
        t = yf.Ticker(ticker)
        info = t.info or {}

        result["name"] = info.get("shortName", "") or info.get("longName", "") or ticker
        price = info.get("currentPrice") or info.get("regularMarketPrice")
        prev = info.get("previousClose")
        result["currency"] = info.get("currency", "USD")

        if price:
            result["price"] = round(float(price), 2)
            if prev and prev > 0:
                result["change_pct"] = round(((price - prev) / prev) * 100, 2)

        result["pe_ratio"] = info.get("trailingPE")
        rg = info.get("revenueGrowth")
        if rg is not None:
            result["revenue_growth"] = round(float(rg) * 100, 1)

        # Quick technicals
        hist = t.history(period="3mo")
        if not hist.empty and len(hist) >= 14:
            closes = hist["Close"].values
            if len(closes) >= 50:
                ma50 = float(np.mean(closes[-50:]))
            else:
                ma50 = None
            rsi_val = compute_rsi(closes, period=14)
            result["rsi"] = round(rsi_val, 1) if rsi_val else None
    except Exception:
        pass

    # Compute long-term score
    try:
        vdata = verdict(ticker)
        if isinstance(vdata, dict):
            result["long_term_score"] = round(vdata.get("composite_score", 0))
            result["long_term_verdict"] = vdata.get("verdict", "")
    except Exception:
        pass

    # Compute short-term score
    try:
        stdata = short_term_verdict(ticker)
        if isinstance(stdata, dict):
            result["short_term_score"] = round(stdata.get("composite_score", 0))
            result["short_term_verdict"] = stdata.get("verdict", "")
    except Exception:
        pass

    return _sanitize(result)


def _refresh_rankings():
    """Background task to compute rankings for all stocks in universe."""
    if _rankings_cache["computing"]:
        return
    _rankings_cache["computing"] = True

    results = []
    # Process in small batches to avoid API rate limits
    batch_size = 8
    for i in range(0, len(RANKINGS_UNIVERSE), batch_size):
        batch = RANKINGS_UNIVERSE[i : i + batch_size]
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = {executor.submit(_compute_single_score, t): t for t in batch}
            for future in as_completed(futures):
                try:
                    r = future.result()
                    if r and (r["long_term_score"] is not None or r["short_term_score"] is not None):
                        results.append(r)
                except Exception:
                    pass
        # Small delay between batches to respect rate limits
        _time.sleep(1)

    # Sort and cache
    long_term = sorted(
        [r for r in results if r["long_term_score"] is not None],
        key=lambda x: x["long_term_score"],
        reverse=True,
    )[:15]

    short_term = sorted(
        [r for r in results if r["short_term_score"] is not None],
        key=lambda x: x["short_term_score"],
        reverse=True,
    )[:15]

    _rankings_cache["long_term"] = long_term
    _rankings_cache["short_term"] = short_term
    _rankings_cache["last_updated"] = datetime.datetime.now().isoformat()
    _rankings_cache["computing"] = False


# --- Politician / Congressional Trades ---

from bs4 import BeautifulSoup
import re as _re

_congress_cache: Dict[str, Any] = {
    "trades": [],
    "last_fetched": None,
}


def _scrape_capitol_trades(pages: int = 5) -> list:
    """Scrape recent trades from Capitol Trades."""
    all_trades = []
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

    for page in range(1, pages + 1):
        try:
            url = f"https://www.capitoltrades.com/trades?page={page}&pageSize=96"
            r = requests.get(url, headers=headers, timeout=20)
            if r.status_code != 200:
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            table = soup.find("table")
            if not table:
                continue
            rows = table.find_all("tr")[1:]  # skip header
            for row in rows:
                cells = row.find_all("td")
                if len(cells) < 9:
                    continue

                # Politician
                pol_cell = cells[0]
                pol_div = pol_cell.find("div", class_=lambda c: c and "cell--politician" in c)
                pol_name_el = pol_div.find("h2") if pol_div else pol_cell.find("h2")
                pol_name = ""
                if pol_name_el:
                    a_tag = pol_name_el.find("a")
                    pol_name = a_tag.get_text(strip=True) if a_tag else pol_name_el.get_text(strip=True)
                party_el = pol_cell.find("span", class_=lambda c: c and any("party" in x for x in (c if isinstance(c, list) else [c])))
                party = party_el.get_text(strip=True) if party_el else ""
                chamber_el = pol_cell.find("span", class_=lambda c: c and any("chamber" in x for x in (c if isinstance(c, list) else [c])))
                chamber = chamber_el.get_text(strip=True) if chamber_el else ""
                state_el = pol_cell.find("span", class_=lambda c: c and any("us-state" in x for x in (c if isinstance(c, list) else [c])))
                state = state_el.get_text(strip=True) if state_el else ""

                # Issuer / Ticker
                issuer_cell = cells[1]
                issuer_h3 = issuer_cell.find("h3") or issuer_cell.find("h2")
                issuer_name = ""
                if issuer_h3:
                    a_tag = issuer_h3.find("a")
                    issuer_name = a_tag.get_text(strip=True) if a_tag else issuer_h3.get_text(strip=True)
                ticker = ""
                issuer_spans = issuer_cell.find_all("span")
                for s in issuer_spans:
                    txt = s.get_text(strip=True)
                    if txt and ":" in txt and txt != "N/A":
                        ticker = txt.split(":")[0]
                    elif txt and txt.isupper() and 1 <= len(txt) <= 5 and txt != "N/A":
                        ticker = txt

                # Skip non-stock trades (bonds, treasury, etc.)
                if not ticker or ticker == "N/A":
                    continue

                # Dates
                pub_date = cells[2].get_text(strip=True).replace("\n", " ")
                trade_date = cells[3].get_text(strip=True).replace("\n", " ")
                # Clean dates: "28 Mar2026" -> "2026-03-28"
                trade_date_clean = _parse_ct_date(trade_date)
                pub_date_clean = _parse_ct_date(pub_date)

                # Type, Size
                trade_type = cells[6].get_text(strip=True).lower()
                amount = cells[7].get_text(strip=True)

                all_trades.append({
                    "politician": pol_name,
                    "party": party,
                    "chamber": chamber,
                    "state": state,
                    "ticker": ticker.upper(),
                    "asset": issuer_name,
                    "type": trade_type,
                    "amount": amount,
                    "transaction_date": trade_date_clean,
                    "disclosure_date": pub_date_clean,
                })
        except Exception:
            continue

    return all_trades


def _parse_ct_date(raw: str) -> str:
    """Parse Capitol Trades date format like '28 Mar2026' -> '2026-03-28'."""
    months = {
        "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04",
        "May": "05", "Jun": "06", "Jul": "07", "Aug": "08",
        "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12",
    }
    raw = raw.strip()
    m = _re.match(r"(\d{1,2})\s*([A-Za-z]{3})\s*(\d{4})", raw)
    if m:
        day = m.group(1).zfill(2)
        mon = months.get(m.group(2), "01")
        year = m.group(3)
        return f"{year}-{mon}-{day}"
    return raw


def _fetch_congress_trades():
    """Fetch and cache congressional trades."""
    now = datetime.datetime.now()
    # Cache for 2 hours
    if _congress_cache["last_fetched"]:
        elapsed = (now - datetime.datetime.fromisoformat(_congress_cache["last_fetched"])).total_seconds()
        if elapsed < 7200 and _congress_cache["trades"]:
            return

    trades = _scrape_capitol_trades(pages=5)
    if trades:
        _congress_cache["trades"] = trades
    _congress_cache["last_fetched"] = now.isoformat()


@app.get("/congress-trades")
def get_congress_trades(ticker: str = None):
    """Get recent congressional stock trades. Optional ticker filter."""
    _fetch_congress_trades()

    all_trades = list(_congress_cache["trades"])

    if ticker:
        ticker_upper = ticker.upper()
        all_trades = [t for t in all_trades if t["ticker"] == ticker_upper]

    # Sort by transaction date descending
    all_trades.sort(key=lambda x: x.get("transaction_date", ""), reverse=True)

    # Stats
    purchases = [t for t in all_trades if t.get("type") == "buy"]
    sales = [t for t in all_trades if "sell" in t.get("type", "")]

    return _sanitize({
        "trades": all_trades[:100],
        "total": len(all_trades),
        "purchases": len(purchases),
        "sales": len(sales),
        "ticker_filter": ticker,
    })


@app.get("/congress-trades/top-bought")
def get_congress_top_bought():
    """Get the most bought stocks by politicians recently."""
    _fetch_congress_trades()

    all_trades = _congress_cache["trades"]
    purchases = [t for t in all_trades if t.get("type") == "buy"]

    # Count purchases per ticker
    ticker_counts: Dict[str, Dict] = {}
    for t in purchases:
        tk = t["ticker"]
        if tk not in ticker_counts:
            ticker_counts[tk] = {"ticker": tk, "asset": t["asset"], "count": 0, "politicians": set(), "latest_date": ""}
        ticker_counts[tk]["count"] += 1
        ticker_counts[tk]["politicians"].add(t["politician"])
        if t["transaction_date"] > ticker_counts[tk]["latest_date"]:
            ticker_counts[tk]["latest_date"] = t["transaction_date"]

    results = []
    for tk, data in ticker_counts.items():
        results.append({
            "ticker": data["ticker"],
            "asset": data["asset"],
            "purchase_count": data["count"],
            "unique_politicians": len(data["politicians"]),
            "politicians": list(data["politicians"])[:5],
            "latest_date": data["latest_date"],
        })

    results.sort(key=lambda x: x["purchase_count"], reverse=True)
    return _sanitize({"top_bought": results[:20]})


@app.get("/rankings")
def get_rankings():
    """Get pre-computed top 15 long-term and short-term buys."""
    return {
        "long_term": _rankings_cache["long_term"],
        "short_term": _rankings_cache["short_term"],
        "last_updated": _rankings_cache["last_updated"],
        "computing": _rankings_cache["computing"],
        "universe_size": len(RANKINGS_UNIVERSE),
    }


@app.post("/rankings/refresh")
def refresh_rankings():
    """Trigger a background refresh of rankings."""
    if _rankings_cache["computing"]:
        return {"status": "already_computing"}
    thread = threading.Thread(target=_refresh_rankings, daemon=True)
    thread.start()
    return {"status": "started", "universe_size": len(RANKINGS_UNIVERSE)}


def _auto_refresh_loop():
    """Automatically refresh rankings every 30 minutes during market hours."""
    while True:
        _time.sleep(30 * 60)  # 30 minutes
        now = datetime.datetime.now()
        # Only auto-refresh on weekdays between 6am-10pm (covers US + EU markets)
        if now.weekday() < 5 and 6 <= now.hour <= 22:
            _refresh_rankings()


@app.on_event("startup")
def startup_event():
    """Start computing rankings in background on server startup."""
    thread = threading.Thread(target=_refresh_rankings, daemon=True)
    thread.start()
    # Start auto-refresh loop
    auto_thread = threading.Thread(target=_auto_refresh_loop, daemon=True)
    auto_thread.start()


# =====================================================================
# INSTITUTIONAL RESEARCH — High-Optionality Compounder Screener
# Screens mid-caps ($2B–$15B) for early-stage Amazon/Nvidia traits
# =====================================================================

SCREENER_SECTORS = {
    "AI Infrastructure": [
        "PATH", "AI", "SOUN", "BBAI", "BIGB", "AMBA", "CEVA", "BRZE",
        "MDAI", "SMCI",
    ],
    "Cybersecurity AI": [
        "S", "CRWD", "ZS", "RBRK", "QLYS", "TENB", "VRNS", "CYBR",
        "RPD", "OKTA",
    ],
    "Robotics & Automation": [
        "ISRG", "TER", "IRBT", "BRKS", "NOVT", "OUST", "AEVA", "LAZR",
        "ACHR", "JOBY",
    ],
    "Photonics & Optical": [
        "AAOI", "LITE", "COHR", "VIAV", "CIEN", "IIVI", "CALX", "ANET",
        "FNSR", "MXL",
    ],
    "Edge Computing & IoT": [
        "NET", "PI", "SLAB", "IOTG", "NTGR", "UI", "SMCI", "PSTG",
        "ESTC", "CFLT",
    ],
    "Synthetic Biology & Genomics": [
        "TXG", "BEAM", "CRSP", "NTLA", "VERV", "RXRX", "TWST", "DNA",
        "SDGR", "ABCL",
    ],
    "Space & Defense Tech": [
        "RKLB", "ASTS", "LUNR", "FLY", "RDW", "MNTS", "BKSY", "SPIR", "PL",
        "KTOS",
    ],
    "Fintech Infrastructure": [
        "SOFI", "HOOD", "AFRM", "BILL", "TOST", "FLYW", "PAYO", "SHOP",
        "FOUR", "MQ",
    ],
    "Clean Energy & Grid": [
        "ENPH", "SEDG", "RUN", "NOVA", "STEM", "CHPT", "BLNK", "QS",
        "FREY", "PTRA",
    ],
}

# Flatten for the full screener universe
SCREENER_UNIVERSE = []
for _sector_tickers in SCREENER_SECTORS.values():
    SCREENER_UNIVERSE.extend(_sector_tickers)

_screener_cache: Dict[str, Any] = {
    "results": [],
    "last_computed": None,
    "computing": False,
}


def _screen_single_compounder(ticker: str, sector: str) -> Optional[dict]:
    """Deep-screen a single stock for compounder characteristics."""
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}

        market_cap = info.get("marketCap")
        if not market_cap:
            return None

        mcap_b = market_cap / 1e9
        name = info.get("shortName", "") or info.get("longName", "") or ticker
        currency = info.get("currency", "USD")
        price = info.get("currentPrice") or info.get("regularMarketPrice")
        prev_close = info.get("previousClose")

        # ---- Hard Filters ----

        # Revenue & Growth
        total_revenue = info.get("totalRevenue", 0) or 0
        revenue_growth = info.get("revenueGrowth")  # YoY as decimal
        rev_growth_pct = round(revenue_growth * 100, 1) if revenue_growth else None

        # R&D / Revenue ratio
        # yfinance: researchDevelopment from financials
        rd_expense = None
        try:
            fins = t.financials
            if fins is not None and not fins.empty:
                for col_name in ["Research Development", "Research And Development", "ResearchAndDevelopment"]:
                    if col_name in fins.index:
                        vals = fins.loc[col_name].dropna()
                        if len(vals) > 0:
                            rd_expense = float(vals.iloc[0])
                        break
        except Exception:
            pass

        rd_ratio = None
        if rd_expense and total_revenue and total_revenue > 0:
            rd_ratio = round((abs(rd_expense) / total_revenue) * 100, 1)

        # Free Cash Flow margin
        fcf = info.get("freeCashflow")
        fcf_margin = None
        if fcf is not None and total_revenue and total_revenue > 0:
            fcf_margin = round((fcf / total_revenue) * 100, 1)

        # Rule of 40 = Revenue Growth % + FCF Margin %
        rule_of_40 = None
        if rev_growth_pct is not None and fcf_margin is not None:
            rule_of_40 = round(rev_growth_pct + fcf_margin, 1)

        # Operating margin & Gross margin
        op_margin = info.get("operatingMargins")
        op_margin_pct = round(op_margin * 100, 1) if op_margin else None
        gross_margin = info.get("grossMargins")
        gross_margin_pct = round(gross_margin * 100, 1) if gross_margin else None

        # SG&A trend (quarterly) — check for operating leverage
        sga_trend = None
        sga_improving = False
        try:
            q_fins = t.quarterly_financials
            if q_fins is not None and not q_fins.empty:
                sga_row = None
                for row_name in ["Selling General Administrative", "SellingGeneralAdministrative",
                                 "Selling General And Administrative", "SellingGeneralAndAdministration"]:
                    if row_name in q_fins.index:
                        sga_row = q_fins.loc[row_name]
                        break
                rev_row = None
                for row_name in ["Total Revenue", "TotalRevenue"]:
                    if row_name in q_fins.index:
                        rev_row = q_fins.loc[row_name]
                        break
                if sga_row is not None and rev_row is not None:
                    sga_pcts = []
                    for col in q_fins.columns[:4]:  # Last 4 quarters
                        s = sga_row.get(col)
                        r = rev_row.get(col)
                        if s and r and r > 0:
                            sga_pcts.append(round(abs(float(s)) / float(r) * 100, 1))
                    if len(sga_pcts) >= 3:
                        sga_trend = sga_pcts  # Most recent first
                        # Improving = each quarter SGA% <= previous (or roughly stable)
                        sga_improving = all(sga_pcts[i] <= sga_pcts[i + 1] + 0.5 for i in range(len(sga_pcts) - 1))
        except Exception:
            pass

        # Magic Number: [(Rev.Q - Rev.Q-1) * 4] / Sales&Mkt.Q-1
        magic_number = None
        try:
            q_fins = t.quarterly_financials
            if q_fins is not None and not q_fins.empty:
                rev_vals = []
                for row_name in ["Total Revenue", "TotalRevenue"]:
                    if row_name in q_fins.index:
                        for col in q_fins.columns[:3]:
                            v = q_fins.loc[row_name, col]
                            if v and not np.isnan(float(v)):
                                rev_vals.append(float(v))
                        break
                sga_vals = []
                for row_name in ["Selling General Administrative", "SellingGeneralAdministrative",
                                 "Selling General And Administrative", "SellingGeneralAndAdministration"]:
                    if row_name in q_fins.index:
                        for col in q_fins.columns[:3]:
                            v = q_fins.loc[row_name, col]
                            if v and not np.isnan(float(v)):
                                sga_vals.append(abs(float(v)))
                        break
                if len(rev_vals) >= 2 and len(sga_vals) >= 2:
                    rev_delta = (rev_vals[0] - rev_vals[1]) * 4
                    if sga_vals[1] > 0:
                        magic_number = round(rev_delta / sga_vals[1], 2)
        except Exception:
            pass

        # Insider Ownership
        insider_pct = info.get("heldPercentInsiders")
        insider_pct_val = round(insider_pct * 100, 1) if insider_pct else None

        # Institutional Ownership
        inst_pct = info.get("heldPercentInstitutions")
        inst_pct_val = round(inst_pct * 100, 1) if inst_pct else None

        # Cash runway
        cash = info.get("totalCash", 0) or 0
        op_cashflow = info.get("operatingCashflow")
        cash_runway_q = None
        if op_cashflow and op_cashflow < 0 and cash > 0:
            # Burning cash — how many quarters?
            quarterly_burn = abs(op_cashflow) / 4
            cash_runway_q = round(cash / quarterly_burn, 1) if quarterly_burn > 0 else None
        elif op_cashflow and op_cashflow > 0:
            cash_runway_q = 999  # Self-funding

        # PE & Forward PE
        pe = info.get("trailingPE")
        fwd_pe = info.get("forwardPE")

        # ---- Scoring System ----
        # Sanity checks for pre-revenue / early-stage companies
        is_pre_revenue = total_revenue and total_revenue > 0 and rd_ratio is not None and rd_ratio > 100
        # Cap extreme values for scoring (keep raw for display)
        rd_ratio_score = min(rd_ratio, 60) if rd_ratio else None
        rule_of_40_score = rule_of_40 if rule_of_40 is not None and -100 < rule_of_40 < 200 else None

        score = 0
        max_score = 0
        flags = []

        # Market cap context
        if mcap_b >= 2 and mcap_b <= 15:
            flags.append(f"Mid-Cap Sweet Spot (${mcap_b:.1f}B)")

        # R&D intensity (20 pts) — capped at 60% for scoring
        max_score += 20
        if rd_ratio_score is not None and not is_pre_revenue:
            if rd_ratio_score >= 25:
                score += 20
                flags.append("Elite R&D (>25%)")
            elif rd_ratio_score >= 18:
                score += 15
                flags.append("High R&D (>18%)")
            elif rd_ratio_score >= 12:
                score += 8
        elif is_pre_revenue:
            # Pre-revenue: cap at 10 pts — R&D is high but business unproven
            score += 10
            flags.append("Pre-Revenue: High R&D (unproven)")

        # Rule of 40 (20 pts) — only score if reasonable range
        max_score += 20
        if rule_of_40_score is not None:
            if rule_of_40_score >= 60:
                score += 20
                flags.append("Rule of 40: Exceptional")
            elif rule_of_40_score >= 40:
                score += 15
                flags.append("Rule of 40: PASS")
            elif rule_of_40_score >= 25:
                score += 8
            elif rule_of_40_score >= 10:
                score += 4

        # Magic Number (15 pts)
        max_score += 15
        if magic_number is not None:
            if magic_number >= 1.0:
                score += 15
                flags.append("Magic Number >1.0: Hyper-efficient")
            elif magic_number >= 0.75:
                score += 12
                flags.append("Magic Number >0.75: Efficient")
            elif magic_number >= 0.5:
                score += 6

        # SG&A Operating Leverage (10 pts)
        max_score += 10
        if sga_improving:
            score += 10
            flags.append("Operating Leverage: SG&A declining")

        # Insider Ownership (10 pts)
        max_score += 10
        if insider_pct_val is not None:
            if insider_pct_val >= 15:
                score += 10
                flags.append(f"Founder-led Premium ({insider_pct_val}%)")
            elif insider_pct_val >= 10:
                score += 8
                flags.append(f"Strong Insider Alignment ({insider_pct_val}%)")
            elif insider_pct_val >= 5:
                score += 4

        # Revenue Growth (15 pts)
        max_score += 15
        if rev_growth_pct is not None:
            if rev_growth_pct >= 40:
                score += 15
                flags.append(f"Hypergrowth ({rev_growth_pct}% YoY)")
            elif rev_growth_pct >= 25:
                score += 12
            elif rev_growth_pct >= 15:
                score += 8
            elif rev_growth_pct >= 5:
                score += 4

        # Gross Margin quality (10 pts)
        max_score += 10
        if gross_margin_pct is not None:
            if gross_margin_pct >= 70:
                score += 10
                flags.append("Software-grade margins")
            elif gross_margin_pct >= 55:
                score += 7
            elif gross_margin_pct >= 40:
                score += 4

        final_score = round((score / max_score) * 100) if max_score > 0 else 0

        # Determine verdict
        if final_score >= 75:
            verdict = "STRONG COMPOUNDER"
        elif final_score >= 60:
            verdict = "HIGH POTENTIAL"
        elif final_score >= 45:
            verdict = "WATCH — EMERGING"
        elif final_score >= 30:
            verdict = "EARLY STAGE"
        else:
            verdict = "INSUFFICIENT"

        return {
            "ticker": ticker,
            "name": name,
            "sector": sector,
            "price": round(float(price), 2) if price else None,
            "change_pct": round(((price - prev_close) / prev_close) * 100, 2) if price and prev_close and prev_close > 0 else None,
            "currency": currency,
            "market_cap_b": round(mcap_b, 2),
            "score": final_score,
            "verdict": verdict,
            "flags": flags,
            "metrics": {
                "rd_ratio": rd_ratio,
                "revenue_growth": rev_growth_pct,
                "rule_of_40": rule_of_40,
                "magic_number": magic_number,
                "fcf_margin": fcf_margin,
                "gross_margin": gross_margin_pct,
                "op_margin": op_margin_pct,
                "insider_pct": insider_pct_val,
                "institutional_pct": inst_pct_val,
                "pe": round(pe, 1) if pe else None,
                "forward_pe": round(fwd_pe, 1) if fwd_pe else None,
                "sga_trend": sga_trend,
                "sga_improving": sga_improving,
                "cash_runway_quarters": cash_runway_q,
                "total_cash_b": round(cash / 1e9, 2) if cash else None,
            },
        }
    except Exception:
        return None


def _run_screener():
    """Run the full compounder screener across all sectors."""
    if _screener_cache["computing"]:
        return
    _screener_cache["computing"] = True

    results = []
    for sector, tickers in SCREENER_SECTORS.items():
        for ticker in tickers:
            try:
                r = _screen_single_compounder(ticker, sector)
                if r:
                    results.append(r)
            except Exception:
                pass
            _time.sleep(0.5)  # Rate limit respect

    # Sort by score descending
    results.sort(key=lambda x: x["score"], reverse=True)

    _screener_cache["results"] = results
    _screener_cache["last_computed"] = datetime.datetime.now().isoformat()
    _screener_cache["computing"] = False


@app.get("/screener")
def get_screener():
    """Get compounder screener results."""
    return _sanitize({
        "results": _screener_cache["results"],
        "last_computed": _screener_cache["last_computed"],
        "computing": _screener_cache["computing"],
        "universe_size": len(SCREENER_UNIVERSE),
        "sectors": list(SCREENER_SECTORS.keys()),
    })


@app.post("/screener/run")
def run_screener():
    """Trigger screener computation in background."""
    if _screener_cache["computing"]:
        return {"status": "already_computing"}
    thread = threading.Thread(target=_run_screener, daemon=True)
    thread.start()
    return {"status": "started", "universe_size": len(SCREENER_UNIVERSE)}


@app.get("/screener/{ticker}")
def screen_single(ticker: str):
    """Screen a single stock with the compounder methodology."""
    ticker = resolve_ticker(ticker)
    # Find its sector
    sector = "Other"
    for s, tickers in SCREENER_SECTORS.items():
        if ticker in tickers:
            sector = s
            break
    result = _screen_single_compounder(ticker, sector)
    if not result:
        raise HTTPException(status_code=404, detail=f"Could not screen {ticker}")
    return _sanitize(result)


# =============================================
# ETF TRACKER & COMPOUND INTEREST SIMULATOR
# =============================================

ETF_UNIVERSE = {
    "CTO": [
        {"ticker": "VOO", "name": "Vanguard S&P 500", "index": "S&P 500", "ter": 0.03},
        {"ticker": "VTI", "name": "Vanguard Total Stock Market", "index": "US Total Market", "ter": 0.03},
        {"ticker": "QQQ", "name": "Invesco Nasdaq 100", "index": "Nasdaq 100", "ter": 0.20},
        {"ticker": "VT", "name": "Vanguard Total World Stock", "index": "FTSE All-World", "ter": 0.07},
        {"ticker": "SCHD", "name": "Schwab US Dividend Equity", "index": "US Dividend", "ter": 0.06},
        {"ticker": "VUG", "name": "Vanguard Growth ETF", "index": "US Large Growth", "ter": 0.04},
        {"ticker": "VGT", "name": "Vanguard Info Technology", "index": "US Tech", "ter": 0.10},
        {"ticker": "SPLG", "name": "SPDR Portfolio S&P 500", "index": "S&P 500", "ter": 0.02},
        {"ticker": "IVV", "name": "iShares Core S&P 500", "index": "S&P 500", "ter": 0.03},
        {"ticker": "VIG", "name": "Vanguard Dividend Appreciation", "index": "US Dividend Growth", "ter": 0.06},
    ],
    "PEA": [
        {"ticker": "CW8.PA", "name": "Amundi MSCI World", "index": "MSCI World", "ter": 0.38},
        {"ticker": "PE500.PA", "name": "Amundi S&P 500 (PEA)", "index": "S&P 500", "ter": 0.15},
        {"ticker": "PANX.PA", "name": "Amundi Nasdaq-100 (PEA)", "index": "Nasdaq 100", "ter": 0.23},
        {"ticker": "EWLD.PA", "name": "Lyxor MSCI World (PEA)", "index": "MSCI World", "ter": 0.45},
        {"ticker": "CEU.PA", "name": "Amundi MSCI Europe", "index": "MSCI Europe", "ter": 0.15},
        {"ticker": "ESE.PA", "name": "BNP Easy S&P 500", "index": "S&P 500", "ter": 0.15},
        {"ticker": "WPEA.PA", "name": "iShares MSCI World Swap PEA", "index": "MSCI World", "ter": 0.25},
        {"ticker": "PSP5.PA", "name": "Lyxor PEA S&P 500", "index": "S&P 500", "ter": 0.15},
    ],
}

_etf_cache: Dict[str, Any] = {"data": None, "last_fetched": None}


def _fetch_etf_data(etf_info: dict) -> Optional[dict]:
    """Fetch ETF performance data using yfinance."""
    try:
        t = yf.Ticker(etf_info["ticker"])
        info = t.info

        price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
        if not price:
            return None

        # Get historical data for performance calculation
        hist = t.history(period="max")
        if hist.empty or len(hist) < 30:
            return None

        current = hist["Close"].iloc[-1]

        # Calculate returns for various periods
        def _calc_return(days: int) -> Optional[float]:
            if len(hist) < days:
                return None
            old = hist["Close"].iloc[-days]
            return round(((current - old) / old) * 100, 2)

        # Annualized return since inception
        total_days = (hist.index[-1] - hist.index[0]).days
        total_years = total_days / 365.25
        if total_years > 0:
            inception_price = hist["Close"].iloc[0]
            total_return = current / inception_price
            annualized = (total_return ** (1 / total_years) - 1) * 100
        else:
            annualized = None

        # Build monthly chart data (last 10 years or max available)
        monthly = hist["Close"].resample("ME").last().dropna()
        if len(monthly) > 120:
            monthly = monthly.iloc[-120:]

        chart_data = []
        if not monthly.empty:
            base = monthly.iloc[0]
            for date, val in monthly.items():
                chart_data.append({
                    "date": date.strftime("%Y-%m"),
                    "value": round(float(val), 2),
                    "indexed": round((float(val) / float(base)) * 100, 2),
                })

        inception_date = hist.index[0].strftime("%Y-%m-%d")

        return {
            "ticker": etf_info["ticker"],
            "name": etf_info["name"],
            "index": etf_info["index"],
            "ter": etf_info["ter"],
            "price": round(float(price), 2),
            "currency": info.get("currency", "USD"),
            "inception_date": inception_date,
            "total_years": round(total_years, 1),
            "annualized_return": round(float(annualized), 2) if annualized else None,
            "return_ytd": _calc_return(len(hist) - len(hist.loc[:f"{datetime.datetime.now().year}-01-01"]) if f"{datetime.datetime.now().year}-01-01" in hist.index else 0),
            "return_1y": _calc_return(252),
            "return_3y": _calc_return(756),
            "return_5y": _calc_return(1260),
            "return_10y": _calc_return(2520),
            "return_since_inception": round(((current - hist["Close"].iloc[0]) / hist["Close"].iloc[0]) * 100, 2),
            "chart": chart_data,
            "market_cap": info.get("totalAssets") or info.get("marketCap") or 0,
        }
    except Exception as e:
        print(f"ETF fetch error for {etf_info['ticker']}: {e}")
        return None


@app.get("/etf")
def get_etf_list():
    """Get all ETFs with basic info and performance."""
    results = {"CTO": [], "PEA": []}

    for account_type, etfs in ETF_UNIVERSE.items():
        for etf_info in etfs:
            data = _fetch_etf_data(etf_info)
            if data:
                results[account_type].append(data)
            _time.sleep(0.3)

    # Sort by annualized return descending
    for account_type in results:
        results[account_type].sort(
            key=lambda x: x.get("annualized_return") or 0,
            reverse=True
        )

    return _sanitize(results)


@app.get("/etf/{ticker}")
def get_etf_detail(ticker: str):
    """Get detailed data for a single ETF."""
    # Find the ETF info
    etf_info = None
    account_type = None
    for at, etfs in ETF_UNIVERSE.items():
        for e in etfs:
            if e["ticker"].upper() == ticker.upper() or e["ticker"].upper().replace(".PA", "") == ticker.upper():
                etf_info = e
                account_type = at
                break

    if not etf_info:
        raise HTTPException(status_code=404, detail=f"ETF {ticker} not found")

    data = _fetch_etf_data(etf_info)
    if not data:
        raise HTTPException(status_code=500, detail=f"Could not fetch data for {ticker}")

    data["account_type"] = account_type
    return _sanitize(data)


@app.get("/etf/compare/{tickers}")
def compare_etfs(tickers: str):
    """Compare multiple ETFs. Tickers separated by commas."""
    ticker_list = [t.strip() for t in tickers.split(",")]
    results = []

    for ticker in ticker_list[:6]:  # Max 6 ETFs
        # Find ETF info
        etf_info = None
        for at, etfs in ETF_UNIVERSE.items():
            for e in etfs:
                if e["ticker"].upper() == ticker.upper() or e["ticker"].upper().replace(".PA", "") == ticker.upper():
                    etf_info = e
                    break

        if etf_info:
            data = _fetch_etf_data(etf_info)
            if data:
                results.append(data)
            _time.sleep(0.3)

    return _sanitize({"etfs": results})


@app.post("/simulator/compound")
def compound_interest_simulator(
    initial: float = 0,
    monthly: float = 0,
    annual_rate: float = 10,
    years: int = 20,
    annual_fees: float = 0,
):
    """Simulate compound interest over time."""
    if years < 1:
        years = 1
    if years > 50:
        years = 50

    net_rate = annual_rate - annual_fees
    monthly_rate = net_rate / 100 / 12

    data_points = []
    balance = initial
    total_invested = initial

    for month in range(years * 12 + 1):
        year = month / 12
        interest_earned = balance - total_invested

        data_points.append({
            "month": month,
            "year": round(year, 2),
            "balance": round(balance, 2),
            "invested": round(total_invested, 2),
            "interest": round(interest_earned, 2),
        })

        if month < years * 12:
            balance = balance * (1 + monthly_rate) + monthly
            total_invested += monthly

    final = data_points[-1]

    return _sanitize({
        "params": {
            "initial": initial,
            "monthly": monthly,
            "annual_rate": annual_rate,
            "annual_fees": annual_fees,
            "net_rate": round(net_rate, 2),
            "years": years,
        },
        "result": {
            "final_capital": final["balance"],
            "total_invested": final["invested"],
            "total_interest": final["interest"],
            "interest_pct": round(final["interest"] / max(final["balance"], 1) * 100, 1),
        },
        "chart": data_points[::max(1, len(data_points) // 120)],  # ~120 points for smooth chart
    })


# =============================================
# IPO WATCHLIST & STOCKS TO WATCH
# =============================================

IPO_WATCHLIST = [
    {
        "company": "SpaceX / Starlink",
        "sector": "Aerospace & Satellite Internet",
        "expected_date": "H2 2026",
        "valuation": "$1.5T (estimated)",
        "valuation_num": 1_500_000_000_000,
        "exchange": "NYSE",
        "status": "SEC filing confirmed",
        "description": "Le plus gros IPO de l'histoire. SpaceX a déposé les documents auprès de la SEC. Le roadshow pourrait commencer dès juin 2026. Starlink, la division internet par satellite rentable en EBITDA, pourrait être introduite séparément. Levée estimée entre 25 et 75 milliards de dollars.",
        "hot": True,
        "confidence": 90,
        "related_stocks": [
            {"ticker": "GOOG", "reason": "Détient ~7% de SpaceX depuis 2015 — gain potentiel de +$100B à l'IPO"},
            {"ticker": "NVDA", "reason": "Fournisseur majeur de GPU pour xAI (filiale IA de Musk) — SpaceX prévoit d'investir massivement en puces Nvidia"},
            {"ticker": "BA", "reason": "Concurrent direct dans le spatial — l'IPO SpaceX pourrait revaloriser tout le secteur aérospatial"},
            {"ticker": "LMT", "reason": "Contrats défense/espace — bénéficie de l'attention accrue sur le secteur spatial"},
            {"ticker": "RKLB", "reason": "Rocket Lab — concurrent direct dans les lancements de petits satellites"},
        ],
    },
    {
        "company": "OpenAI",
        "sector": "Intelligence Artificielle",
        "expected_date": "H2 2026 / début 2027",
        "valuation": "$500B+ (dernière valorisation)",
        "valuation_num": 500_000_000_000,
        "exchange": "NASDAQ",
        "status": "Conversion en for-profit en cours",
        "description": "Créateur de ChatGPT et GPT-5. OpenAI est en train de se convertir en entreprise à but lucratif, étape nécessaire avant l'IPO. La valorisation pourrait atteindre $1T lors de l'introduction. Le timing dépend de la finalisation de la restructuration juridique.",
        "hot": True,
        "confidence": 75,
        "related_stocks": [
            {"ticker": "MSFT", "reason": "Investisseur principal (~49% des revenus) et partenaire cloud Azure — exposition directe à OpenAI"},
            {"ticker": "NVDA", "reason": "Fournisseur exclusif des GPU H100/B200 pour l'entraînement des modèles GPT"},
            {"ticker": "AAPL", "reason": "Partenariat Apple Intelligence avec OpenAI intégré dans iOS — dépendance croissante"},
            {"ticker": "CRM", "reason": "Salesforce utilise les modèles OpenAI dans Einstein AI — bénéficiaire indirect"},
        ],
    },
    {
        "company": "Anthropic",
        "sector": "Intelligence Artificielle (Safety)",
        "expected_date": "H2 2026 / 2027",
        "valuation": "$60B+ (dernière levée)",
        "valuation_num": 60_000_000_000,
        "exchange": "NASDAQ",
        "status": "Conseillers juridiques engagés pour l'IPO",
        "description": "Créateur de Claude. Anthropic a engagé des conseillers juridiques pour préparer l'IPO. Fondée par d'anciens dirigeants d'OpenAI, l'entreprise se positionne sur la sécurité de l'IA. Amazon est le principal investisseur avec $4B+ investis.",
        "hot": True,
        "confidence": 70,
        "related_stocks": [
            {"ticker": "AMZN", "reason": "Investisseur majeur ($4B+) et partenaire cloud AWS — détient une part significative d'Anthropic"},
            {"ticker": "GOOG", "reason": "Investisseur ($2B+) dans Anthropic — double exposition SpaceX + Anthropic"},
            {"ticker": "NVDA", "reason": "Fournisseur GPU pour l'entraînement de Claude et les clusters de calcul"},
        ],
    },
    {
        "company": "Stripe",
        "sector": "Fintech / Paiements",
        "expected_date": "H1-H2 2026",
        "valuation": "$159B (tender offer 2025)",
        "valuation_num": 159_000_000_000,
        "exchange": "NYSE",
        "status": "IPO window monitoring — reste privé pour l'instant",
        "description": "Le 'OS financier' de l'internet. Stripe a complété un tender offer à $159B mais choisit de rester privé pour le moment. L'entreprise se positionne comme infrastructure financière pour les agents IA. L'IPO serait l'un des plus gros de la fintech.",
        "hot": False,
        "confidence": 55,
        "related_stocks": [
            {"ticker": "ADYEN", "reason": "Concurrent direct européen — l'IPO Stripe fixerait un benchmark de valorisation"},
            {"ticker": "SQ", "reason": "Block/Square — concurrent direct, une IPO Stripe à $159B pourrait revaloriser SQ"},
            {"ticker": "PYPL", "reason": "PayPal — même secteur, l'attention sur Stripe profite à tout le secteur paiements"},
            {"ticker": "SHOP", "reason": "Shopify utilise Stripe comme processeur de paiement principal"},
        ],
    },
    {
        "company": "Databricks",
        "sector": "Data & IA / Cloud",
        "expected_date": "H2 2026 / 2027",
        "valuation": "$134B (Series L, 2025)",
        "valuation_num": 134_000_000_000,
        "exchange": "NASDAQ",
        "status": "CFO confirme 'prêt à entrer en bourse'",
        "description": "Plateforme lakehouse unifiée pour le data engineering et le ML. Levée de $10B début 2025 à $134B. Le CFO a déclaré que Databricks est 'prêt quand il le décidera'. Revenu estimé à $3B+ annualisé.",
        "hot": False,
        "confidence": 60,
        "related_stocks": [
            {"ticker": "SNOW", "reason": "Snowflake — concurrent direct, l'IPO Databricks impacterait directement sa valorisation"},
            {"ticker": "MDB", "reason": "MongoDB — écosystème data, bénéficie de l'attention sur le secteur"},
            {"ticker": "DDOG", "reason": "Datadog — observabilité, souvent déployé avec Databricks"},
        ],
    },
    {
        "company": "Canva",
        "sector": "Design & Productivité",
        "expected_date": "2026",
        "valuation": "$42B (vente secondaire 2025)",
        "valuation_num": 42_000_000_000,
        "exchange": "NASDAQ",
        "status": "IPO attendu — transition vers l'entreprise",
        "description": "Plateforme de design avec 260M d'utilisateurs et 29M de payants. Revenu annualisé de $3.5B. Canva fait la transition du consommateur vers l'entreprise, ce qui soutiendrait une valorisation premium à l'IPO.",
        "hot": False,
        "confidence": 65,
        "related_stocks": [
            {"ticker": "ADBE", "reason": "Adobe — concurrent direct (Figma, Creative Cloud), l'IPO Canva met la pression"},
            {"ticker": "FIGM", "reason": "Figma (si coté) — concurrent direct dans le design collaboratif"},
        ],
    },
    {
        "company": "Klarna",
        "sector": "Fintech / Buy Now Pay Later",
        "expected_date": "H1 2026",
        "valuation": "$15-20B (estimé)",
        "valuation_num": 17_500_000_000,
        "exchange": "NYSE",
        "status": "Retour à la rentabilité — IPO imminent",
        "description": "Leader du BNPL en Europe. Klarna est revenu à la rentabilité après une restructuration massive. L'entreprise est sous pression pour entrer en bourse rapidement pour capitaliser sur le momentum positif.",
        "hot": True,
        "confidence": 85,
        "related_stocks": [
            {"ticker": "AFRM", "reason": "Affirm — concurrent direct BNPL, valorisation directement impactée par l'IPO Klarna"},
            {"ticker": "PYPL", "reason": "PayPal (BNPL intégré) — même secteur, comparaison de multiples"},
            {"ticker": "SQ", "reason": "Block/Afterpay — concurrent BNPL, corrélation directe"},
        ],
    },
    {
        "company": "Shein",
        "sector": "E-commerce / Fast Fashion",
        "expected_date": "2026-2027",
        "valuation": "$30B (révisé à la baisse)",
        "valuation_num": 30_000_000_000,
        "exchange": "HKEX (Hong Kong)",
        "status": "Filing confidentiel à Hong Kong",
        "description": "Géant de la fast fashion en ligne. Après des tentatives ratées aux US et à Londres (problèmes de gouvernance et supply chain), Shein vise Hong Kong. Valorisation en baisse de $100B à $30B.",
        "hot": False,
        "confidence": 50,
        "related_stocks": [
            {"ticker": "AMZN", "reason": "Amazon — concurrent e-commerce, l'IPO Shein met en lumière la compétition"},
            {"ticker": "INDT", "reason": "Inditex (Zara) — concurrent fast fashion, impact direct sur les multiples"},
        ],
    },
    {
        "company": "Revolut",
        "sector": "Fintech / Néobanque",
        "expected_date": "H2 2026 / 2027",
        "valuation": "$45B (tender offer 2024)",
        "valuation_num": 45_000_000_000,
        "exchange": "LSE / NASDAQ",
        "status": "Croissance forte — licence bancaire UK obtenue",
        "description": "Néobanque européenne avec un revenu en hausse de 72% à $4B en 2024. Free cash flow positif. Licence bancaire UK obtenue. L'IPO pourrait se faire à Londres ou au Nasdaq.",
        "hot": False,
        "confidence": 60,
        "related_stocks": [
            {"ticker": "NU", "reason": "Nu Holdings (Nubank) — comparable direct, néobanque cotée au NYSE"},
            {"ticker": "SOFI", "reason": "SoFi — fintech US comparable, corrélation sur les multiples"},
        ],
    },
    {
        "company": "Plaid",
        "sector": "Fintech / Infrastructure",
        "expected_date": "2026",
        "valuation": "$8B (tender offer début 2026)",
        "valuation_num": 8_000_000_000,
        "exchange": "NASDAQ",
        "status": "Valorisation en hausse — IPO probable",
        "description": "Infrastructure de connexion bancaire utilisée par la plupart des fintechs. Plaid connecte les apps financières aux comptes bancaires des utilisateurs. Valorisation passée de $6.1B à $8B début 2026.",
        "hot": False,
        "confidence": 55,
        "related_stocks": [
            {"ticker": "FIS", "reason": "Fidelity National — infrastructure financière comparable"},
            {"ticker": "FISV", "reason": "Fiserv — même secteur infrastructure paiements"},
        ],
    },
]


@app.get("/ipo-watchlist")
def get_ipo_watchlist():
    """Get the IPO watchlist with related stocks."""
    # Fetch current prices for related stocks
    all_related_tickers = set()
    for ipo in IPO_WATCHLIST:
        for rs in ipo.get("related_stocks", []):
            all_related_tickers.add(rs["ticker"])

    # Batch fetch prices
    prices = {}
    for ticker in all_related_tickers:
        try:
            t = yf.Ticker(ticker)
            info = t.info
            p = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
            chg = info.get("regularMarketChangePercent", 0)
            mcap = info.get("marketCap", 0)
            prices[ticker] = {"price": round(float(p), 2) if p else None, "change_pct": round(float(chg), 2) if chg else 0, "market_cap": mcap}
        except Exception:
            prices[ticker] = {"price": None, "change_pct": 0, "market_cap": 0}
        _time.sleep(0.2)

    # Enrich IPO data with live prices
    result = []
    for ipo in IPO_WATCHLIST:
        enriched = dict(ipo)
        enriched_stocks = []
        for rs in ipo.get("related_stocks", []):
            stock = dict(rs)
            stock.update(prices.get(rs["ticker"], {}))
            enriched_stocks.append(stock)
        enriched["related_stocks"] = enriched_stocks
        result.append(enriched)

    # Sort by confidence descending, then by valuation
    result.sort(key=lambda x: (x.get("hot", False), x.get("confidence", 0)), reverse=True)

    return _sanitize({"ipos": result, "total": len(result)})


# ── Options Flow / Unusual Activity ──────────────────────────────────────

def _get_options_flow(ticker: str) -> dict:
    """Analyze options chain for unusual activity on a single ticker."""
    t = yf.Ticker(ticker)
    expirations = t.options
    if not expirations:
        return {}

    # Take nearest expiry + next month (up to 2)
    expiries_to_scan = list(expirations[:min(4, len(expirations))])

    unusual_calls = []
    unusual_puts = []
    total_call_vol = 0
    total_put_vol = 0
    total_call_oi = 0
    total_put_oi = 0
    top_contracts = []

    for exp in expiries_to_scan:
        try:
            chain = t.option_chain(exp)
        except Exception:
            continue

        for side, df, label in [("calls", chain.calls, "CALL"), ("puts", chain.puts, "PUT")]:
            if df is None or df.empty:
                continue
            for _, row in df.iterrows():
                def _safe_int(v, d=0):
                    try:
                        f = float(v) if v is not None else d
                        return int(f) if not (f != f) else d  # NaN check
                    except (ValueError, TypeError):
                        return d
                def _safe_float(v, d=0.0):
                    try:
                        f = float(v) if v is not None else d
                        return f if not (f != f) else d
                    except (ValueError, TypeError):
                        return d
                vol = _safe_int(row.get("volume", 0))
                oi = _safe_int(row.get("openInterest", 0))
                strike = _safe_float(row.get("strike", 0))
                last = _safe_float(row.get("lastPrice", 0))
                bid = _safe_float(row.get("bid", 0))
                ask = _safe_float(row.get("ask", 0))
                iv = _safe_float(row.get("impliedVolatility", 0))
                itm = bool(row.get("inTheMoney", False))

                if label == "CALL":
                    total_call_vol += vol
                    total_call_oi += oi
                else:
                    total_put_vol += vol
                    total_put_oi += oi

                ratio = round(vol / oi, 2) if oi > 0 else 0
                premium = round(vol * last * 100, 2) if vol > 0 and last > 0 else 0

                contract = {
                    "strike": strike,
                    "expiry": exp,
                    "type": label,
                    "volume": vol,
                    "open_interest": oi,
                    "vol_oi_ratio": ratio,
                    "last_price": round(last, 2),
                    "bid": round(bid, 2),
                    "ask": round(ask, 2),
                    "implied_volatility": round(iv * 100, 1),
                    "in_the_money": itm,
                    "premium": round(premium, 0),
                }

                # Unusual = volume > 2x open interest
                if vol > 0 and oi > 0 and vol > 2 * oi:
                    if label == "CALL":
                        unusual_calls.append(contract)
                    else:
                        unusual_puts.append(contract)

                if vol > 100:
                    top_contracts.append(contract)

    # Sort unusual by vol/OI ratio descending
    unusual_calls.sort(key=lambda x: x["vol_oi_ratio"], reverse=True)
    unusual_puts.sort(key=lambda x: x["vol_oi_ratio"], reverse=True)
    top_contracts.sort(key=lambda x: x["volume"], reverse=True)
    top_contracts = top_contracts[:15]

    put_call_ratio = round(total_put_vol / total_call_vol, 2) if total_call_vol > 0 else 0

    return {
        "ticker": ticker,
        "expiries_analyzed": expiries_to_scan,
        "unusual_calls": unusual_calls[:20],
        "unusual_puts": unusual_puts[:20],
        "put_call_ratio": put_call_ratio,
        "total_call_volume": total_call_vol,
        "total_put_volume": total_put_vol,
        "total_call_oi": total_call_oi,
        "total_put_oi": total_put_oi,
        "top_contracts": top_contracts,
    }


def _generate_options_ai_summary(data: dict) -> str:
    """Generate a French AI summary of options flow."""
    ticker = data.get("ticker", "")
    pcr = data.get("put_call_ratio", 0)
    n_unusual_calls = len(data.get("unusual_calls", []))
    n_unusual_puts = len(data.get("unusual_puts", []))
    total_cv = data.get("total_call_volume", 0)
    total_pv = data.get("total_put_volume", 0)

    parts = []

    # Put/Call ratio analysis
    if pcr > 1.5:
        parts.append(
            f"Le ratio put/call de {pcr} pour {ticker} indique un sentiment tres bearish sur le marche des options. "
            f"Les traders d'options positionnent massivement des protections a la baisse, ce qui peut signaler "
            f"soit une anticipation de mauvaises nouvelles, soit une couverture institutionnelle importante."
        )
    elif pcr > 1.0:
        parts.append(
            f"Le ratio put/call de {pcr} pour {ticker} montre une legere dominance des puts, "
            f"suggerant une prudence accrue des participants du marche. Ce niveau est souvent associe "
            f"a une phase de consolidation ou d'incertitude."
        )
    elif pcr > 0.5:
        parts.append(
            f"Le ratio put/call de {pcr} pour {ticker} est dans une zone neutre-haussiere. "
            f"L'equilibre relatif entre calls et puts indique un marche sans conviction extreme, "
            f"typique d'une phase d'accumulation ou d'attente de catalyseur."
        )
    else:
        parts.append(
            f"Le ratio put/call de {pcr} pour {ticker} est resolument bullish. "
            f"La forte dominance des calls ({total_cv:,} volume calls vs {total_pv:,} puts) "
            f"indique un positionnement agressif a la hausse de la part des traders d'options."
        )

    # Unusual activity analysis
    total_unusual = n_unusual_calls + n_unusual_puts
    if total_unusual > 10:
        parts.append(
            f"Activite inhabituelle significative detectee: {n_unusual_calls} calls et {n_unusual_puts} puts "
            f"avec un volume depassant 2x l'open interest. Ce niveau d'activite anormale suggere "
            f"un flux d'ordres institutionnel ou une anticipation d'un evenement majeur (earnings, FDA, M&A). "
            f"Les smart money flows de cette ampleur meritent une attention particuliere."
        )
    elif total_unusual > 3:
        parts.append(
            f"Activite inhabituelle moderee: {n_unusual_calls} calls et {n_unusual_puts} puts "
            f"avec un ratio volume/OI eleve. Ces contrats specifiques pourraient representer "
            f"des paris directionnels informes ou des strategies de couverture sectorielle."
        )
    elif total_unusual > 0:
        parts.append(
            f"Quelques contrats montrent une activite inhabituelle ({total_unusual} au total). "
            f"A ce niveau, il peut s'agir de flux opportunistes ponctuels plutot que d'un signal directionnel fort."
        )
    else:
        parts.append(
            f"Aucune activite options particulierement inhabituelle detectee pour {ticker}. "
            f"Le flux d'ordres semble normal et en ligne avec les volumes historiques."
        )

    # Top contract highlights
    top = data.get("top_contracts", [])
    if top:
        biggest = top[0]
        parts.append(
            f"Le contrat le plus actif est le {biggest['type']} strike ${biggest['strike']} "
            f"exp. {biggest['expiry']} avec {biggest['volume']:,} contrats echanges "
            f"(~${biggest.get('premium', 0):,.0f} en prime). "
            f"Surveillez les niveaux de strike concentres pour identifier les zones de support/resistance "
            f"implicites definies par le marche des options."
        )

    return " ".join(parts)


@app.get("/options-flow/screener/unusual")
def options_screener_unusual():
    """Scan popular tickers for unusual options activity."""
    # Build scan list from SCREENER_SECTORS (deduplicated)
    scan_tickers = []
    seen = set()
    for tickers_list in SCREENER_SECTORS.values():
        for t in tickers_list:
            if t not in seen:
                scan_tickers.append(t)
                seen.add(t)

    # Also add mega-caps for broader coverage
    mega_caps = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD", "NFLX", "SPY", "QQQ", "IWM"]
    for t in mega_caps:
        if t not in seen:
            scan_tickers.append(t)
            seen.add(t)

    results = []
    scan_start = datetime.datetime.now(datetime.timezone.utc)

    def _scan_one(tk):
        try:
            t = yf.Ticker(tk)
            expirations = t.options
            if not expirations:
                return []
            # Only scan nearest expiry for speed
            chain = t.option_chain(expirations[0])
            hits = []
            for side, df, label in [("calls", chain.calls, "CALL"), ("puts", chain.puts, "PUT")]:
                if df is None or df.empty:
                    continue
                for _, row in df.iterrows():
                    def _si(v, d=0):
                        try:
                            f = float(v) if v is not None else d
                            return int(f) if not (f != f) else d
                        except (ValueError, TypeError):
                            return d
                    def _sf(v, d=0.0):
                        try:
                            f = float(v) if v is not None else d
                            return f if not (f != f) else d
                        except (ValueError, TypeError):
                            return d
                    vol = _si(row.get("volume", 0))
                    oi = _si(row.get("openInterest", 0))
                    if vol < 100 or oi < 10:
                        continue
                    ratio = round(vol / oi, 2) if oi > 0 else 0
                    if ratio < 2.0:
                        continue
                    last = _sf(row.get("lastPrice", 0))
                    premium = round(vol * last * 100, 0)
                    hits.append({
                        "ticker": tk,
                        "type": label,
                        "strike": _sf(row.get("strike", 0)),
                        "expiry": expirations[0],
                        "volume": vol,
                        "open_interest": oi,
                        "vol_oi_ratio": ratio,
                        "last_price": round(last, 2),
                        "premium": premium,
                        "implied_volatility": round(_sf(row.get("impliedVolatility", 0)) * 100, 1),
                        "in_the_money": bool(row.get("inTheMoney", False)),
                    })
            return hits
        except Exception:
            return []

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(_scan_one, tk): tk for tk in scan_tickers}
        for future in as_completed(futures):
            try:
                hits = future.result(timeout=15)
                results.extend(hits)
            except Exception:
                pass

    # Sort by vol/OI ratio descending, take top 20
    results.sort(key=lambda x: x["vol_oi_ratio"], reverse=True)
    results = results[:20]

    scan_time = (datetime.datetime.now(datetime.timezone.utc) - scan_start).total_seconds()

    return _sanitize({
        "results": results,
        "scan_time": round(scan_time, 1),
        "tickers_scanned": len(scan_tickers),
    })


@app.get("/options-flow/{ticker}")
def options_flow(ticker: str):
    """Get options flow and unusual activity for a specific ticker."""
    ticker = resolve_ticker(ticker)
    try:
        data = _get_options_flow(ticker)
        if not data:
            raise HTTPException(status_code=404, detail=f"No options data available for {ticker}")
        data["ai_summary"] = _generate_options_ai_summary(data)
        return _sanitize(data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching options flow: {str(e)}")


# =========================================================
# ECONOMIC CALENDAR
# =========================================================

# Known recurring US macro events with typical schedule
RECURRING_MACRO_EVENTS = [
    {"event": "FOMC Interest Rate Decision", "frequency": "8x/year", "impact": "high", "country": "US",
     "description": "Décision de taux directeur de la Fed — l'événement le plus impactant pour les marchés."},
    {"event": "CPI (YoY)", "frequency": "monthly", "impact": "high", "country": "US",
     "description": "Indice des prix à la consommation — indicateur clé de l'inflation."},
    {"event": "Core CPI (MoM)", "frequency": "monthly", "impact": "high", "country": "US",
     "description": "CPI hors alimentation et énergie — mesure préférée de l'inflation sous-jacente."},
    {"event": "Non-Farm Payrolls", "frequency": "monthly (1st Friday)", "impact": "high", "country": "US",
     "description": "Créations d'emplois hors agriculture — baromètre de la santé du marché du travail."},
    {"event": "GDP (QoQ)", "frequency": "quarterly", "impact": "high", "country": "US",
     "description": "Produit intérieur brut — mesure directe de la croissance économique."},
    {"event": "PCE Price Index", "frequency": "monthly", "impact": "medium", "country": "US",
     "description": "Indice PCE — l'indicateur d'inflation préféré de la Fed."},
    {"event": "PPI (MoM)", "frequency": "monthly", "impact": "medium", "country": "US",
     "description": "Indice des prix à la production — indicateur avancé de l'inflation consommateur."},
    {"event": "Retail Sales (MoM)", "frequency": "monthly", "impact": "medium", "country": "US",
     "description": "Ventes au détail — mesure de la consommation des ménages (70% du PIB US)."},
    {"event": "Initial Jobless Claims", "frequency": "weekly (Thursday)", "impact": "low", "country": "US",
     "description": "Inscriptions hebdomadaires au chômage — indicateur temps réel du marché du travail."},
    {"event": "FOMC Minutes", "frequency": "3 weeks after FOMC", "impact": "medium", "country": "US",
     "description": "Compte-rendu détaillé des discussions de la Fed — révèle les nuances du débat interne."},
]

IMPACT_ORDER = {"high": 3, "medium": 2, "low": 1}


@app.get("/economic-calendar")
def economic_calendar(days: int = 14):
    """Get upcoming economic events."""
    today = datetime.date.today()
    start = today.strftime("%Y-%m-%d")
    end = (today + datetime.timedelta(days=days)).strftime("%Y-%m-%d")

    events = []

    # Try Finnhub economic calendar
    try:
        resp = requests.get(
            "https://finnhub.io/api/v1/calendar/economic",
            params={"from": start, "to": end, "token": FINNHUB_API_KEY},
            timeout=10,
        )
        if resp.status_code == 200:
            raw = resp.json()
            for ev in raw.get("economicCalendar", []):
                event_name = ev.get("event", "")
                country = ev.get("country", "")
                # Focus on US, EU, and major economies
                if country not in ("US", "EU", "GB", "JP", "CN", "DE", "FR"):
                    continue

                # Classify impact
                impact = "low"
                high_keywords = ["fomc", "interest rate", "cpi", "non-farm", "nonfarm", "payroll", "gdp"]
                med_keywords = ["pce", "ppi", "retail sales", "consumer confidence", "ism", "pmi", "housing"]
                name_lower = event_name.lower()
                if any(k in name_lower for k in high_keywords):
                    impact = "high"
                elif any(k in name_lower for k in med_keywords):
                    impact = "medium"

                actual = ev.get("actual")
                estimate = ev.get("estimate")
                prev = ev.get("prev")

                events.append({
                    "date": ev.get("date", ""),
                    "time": ev.get("time", ""),
                    "country": country,
                    "event": event_name,
                    "impact": impact,
                    "actual": str(actual) if actual is not None else None,
                    "estimate": str(estimate) if estimate is not None else None,
                    "previous": str(prev) if prev is not None else None,
                    "unit": ev.get("unit", ""),
                })
    except Exception:
        pass

    # If Finnhub returned very little, supplement with hardcoded known events
    if len([e for e in events if e["impact"] == "high"]) < 2:
        # Add known fixed events for coming weeks
        import calendar as cal

        # FOMC 2026 dates (approximate)
        fomc_dates_2026 = [
            "2026-01-28", "2026-03-18", "2026-05-06", "2026-06-17",
            "2026-07-29", "2026-09-16", "2026-11-04", "2026-12-16",
        ]

        for fd in fomc_dates_2026:
            d = datetime.date.fromisoformat(fd)
            if today <= d <= today + datetime.timedelta(days=days):
                if not any(e["event"] == "FOMC Interest Rate Decision" and e["date"] == fd for e in events):
                    events.append({
                        "date": fd,
                        "time": "14:00",
                        "country": "US",
                        "event": "FOMC Interest Rate Decision",
                        "impact": "high",
                        "actual": None,
                        "estimate": None,
                        "previous": None,
                        "unit": "%",
                    })

        # NFP: first Friday of each month
        for month_offset in range(3):
            m = today.month + month_offset
            y = today.year
            if m > 12:
                m -= 12
                y += 1
            # First Friday
            first_day = datetime.date(y, m, 1)
            first_friday = first_day + datetime.timedelta(days=(4 - first_day.weekday()) % 7)
            fd_str = first_friday.strftime("%Y-%m-%d")
            if today <= first_friday <= today + datetime.timedelta(days=days):
                if not any("payroll" in e["event"].lower() and e["date"] == fd_str for e in events):
                    events.append({
                        "date": fd_str,
                        "time": "08:30",
                        "country": "US",
                        "event": "Non-Farm Payrolls",
                        "impact": "high",
                        "actual": None,
                        "estimate": None,
                        "previous": None,
                        "unit": "K",
                    })

        # CPI: typically around 12th-14th of each month
        for month_offset in range(3):
            m = today.month + month_offset
            y = today.year
            if m > 12:
                m -= 12
                y += 1
            cpi_date = datetime.date(y, m, 13)  # approximate
            fd_str = cpi_date.strftime("%Y-%m-%d")
            if today <= cpi_date <= today + datetime.timedelta(days=days):
                if not any("cpi" in e["event"].lower() and e["date"] == fd_str for e in events):
                    events.append({
                        "date": fd_str,
                        "time": "08:30",
                        "country": "US",
                        "event": "CPI (YoY)",
                        "impact": "high",
                        "actual": None,
                        "estimate": None,
                        "previous": None,
                        "unit": "%",
                    })

        # Jobless Claims: every Thursday
        current = today
        while current <= today + datetime.timedelta(days=days):
            if current.weekday() == 3:  # Thursday
                fd_str = current.strftime("%Y-%m-%d")
                if not any("jobless" in e["event"].lower() and e["date"] == fd_str for e in events):
                    events.append({
                        "date": fd_str,
                        "time": "08:30",
                        "country": "US",
                        "event": "Initial Jobless Claims",
                        "impact": "low",
                        "actual": None,
                        "estimate": None,
                        "previous": None,
                        "unit": "K",
                    })
            current += datetime.timedelta(days=1)

    # Sort by date + impact
    events.sort(key=lambda x: (x["date"], -IMPACT_ORDER.get(x["impact"], 0)))

    # Group into this_week / next_week
    today_iso = today.isocalendar()
    this_week = []
    next_week = []
    rest = []
    for ev in events:
        try:
            ev_date = datetime.date.fromisoformat(ev["date"])
            ev_iso = ev_date.isocalendar()
            if ev_iso[1] == today_iso[1] and ev_iso[0] == today_iso[0]:
                this_week.append(ev)
            elif ev_iso[1] == today_iso[1] + 1 and ev_iso[0] == today_iso[0]:
                next_week.append(ev)
            else:
                rest.append(ev)
        except Exception:
            rest.append(ev)

    high_impact_count = len([e for e in events if e["impact"] == "high"])

    # Generate AI summary
    high_events = [e for e in events if e["impact"] == "high"]
    summary_parts = []

    if high_events:
        summary_parts.append(
            f"{high_impact_count} événement{'s' if high_impact_count > 1 else ''} à fort impact dans les {days} prochains jours."
        )
        # Check for specific events
        has_fomc = any("fomc" in e["event"].lower() for e in high_events)
        has_cpi = any("cpi" in e["event"].lower() for e in high_events)
        has_nfp = any("payroll" in e["event"].lower() or "nfp" in e["event"].lower() for e in high_events)

        if has_fomc:
            summary_parts.append(
                "Réunion FOMC à venir — les marchés seront en mode 'wait and see' jusqu'à la décision. "
                "Attendez-vous à une volatilité accrue sur les taux, le dollar et les indices."
            )
        if has_cpi:
            summary_parts.append(
                "Publication CPI imminente — c'est le chiffre le plus surveillé par la Fed. "
                "Un CPI supérieur aux attentes renforcerait le dollar et pèserait sur les actions growth. "
                "Un CPI inférieur aux attentes alimenterait les espoirs de baisse de taux."
            )
        if has_nfp:
            summary_parts.append(
                "Non-Farm Payrolls à surveiller — un marché du travail solide soutient la consommation "
                "mais réduit les chances de baisse de taux. Un chiffre faible pourrait créer un rallye obligataire."
            )
    else:
        summary_parts.append(
            "Semaine relativement calme côté macro. Pas d'événements majeurs attendus, "
            "ce qui laisse le champ libre aux catalyseurs micro (earnings, M&A, guidance)."
        )

    # Today highlights
    today_events = [e for e in events if e["date"] == today.strftime("%Y-%m-%d")]
    if today_events:
        today_high = [e for e in today_events if e["impact"] == "high"]
        if today_high:
            summary_parts.append(
                f"⚠️ AUJOURD'HUI: {', '.join(e['event'] for e in today_high)} — "
                "restez vigilant, la volatilité intraday sera élevée."
            )

    ai_summary = " ".join(summary_parts)

    return _sanitize({
        "events": events,
        "this_week": this_week,
        "next_week": next_week,
        "high_impact_count": high_impact_count,
        "recurring_events": RECURRING_MACRO_EVENTS,
        "ai_summary": ai_summary,
    })


# =========================================================
# SECTOR HEATMAP
# =========================================================

@app.get("/heatmap")
def sector_heatmap(period: str = "1d"):
    """Get sector performance heatmap data."""
    results = {}

    def _get_sector_perf(sector, tickers):
        sector_data = []
        for tk in tickers[:8]:  # limit per sector for speed
            try:
                t = yf.Ticker(tk)
                if period == "1d":
                    hist = t.history(period="2d")
                    if len(hist) >= 2:
                        change = ((hist["Close"].iloc[-1] - hist["Close"].iloc[-2]) / hist["Close"].iloc[-2]) * 100
                    else:
                        continue
                elif period == "1w":
                    hist = t.history(period="5d")
                    if len(hist) >= 2:
                        change = ((hist["Close"].iloc[-1] - hist["Close"].iloc[0]) / hist["Close"].iloc[0]) * 100
                    else:
                        continue
                elif period == "1m":
                    hist = t.history(period="1mo")
                    if len(hist) >= 2:
                        change = ((hist["Close"].iloc[-1] - hist["Close"].iloc[0]) / hist["Close"].iloc[0]) * 100
                    else:
                        continue
                else:
                    hist = t.history(period="2d")
                    if len(hist) >= 2:
                        change = ((hist["Close"].iloc[-1] - hist["Close"].iloc[-2]) / hist["Close"].iloc[-2]) * 100
                    else:
                        continue

                price = round(float(hist["Close"].iloc[-1]), 2)
                sector_data.append({
                    "ticker": tk,
                    "price": price,
                    "change_pct": round(float(change), 2),
                })
            except Exception:
                continue
        return sector, sector_data

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(_get_sector_perf, s, t) for s, t in SCREENER_SECTORS.items()]
        for f in as_completed(futures):
            try:
                sector, data = f.result(timeout=20)
                if data:
                    avg_change = round(sum(d["change_pct"] for d in data) / len(data), 2)
                    results[sector] = {
                        "stocks": sorted(data, key=lambda x: x["change_pct"], reverse=True),
                        "avg_change": avg_change,
                        "count": len(data),
                    }
            except Exception:
                pass

    # Sort sectors by performance
    sorted_sectors = sorted(results.items(), key=lambda x: x[1]["avg_change"], reverse=True)

    return _sanitize({
        "period": period,
        "sectors": {s: d for s, d in sorted_sectors},
    })


# =========================================================
# FEAR & GREED INDEX
# =========================================================

@app.get("/fear-greed")
def fear_greed_index():
    """Compute a market fear & greed composite index."""
    signals = {}

    try:
        # 1. VIX (Fear gauge)
        vix = yf.Ticker("^VIX")
        vix_hist = vix.history(period="5d")
        if not vix_hist.empty:
            vix_val = float(vix_hist["Close"].iloc[-1])
            signals["vix"] = {
                "value": round(vix_val, 1),
                "label": "VIX (Volatilité)",
                "signal": "extreme_fear" if vix_val > 30 else "fear" if vix_val > 20 else "neutral" if vix_val > 15 else "greed" if vix_val > 12 else "extreme_greed",
                "score": max(0, min(100, 100 - (vix_val - 10) * 2.5)),
                "description": f"VIX à {round(vix_val, 1)} — {'volatilité extrême, panique sur les marchés' if vix_val > 30 else 'volatilité élevée, prudence' if vix_val > 20 else 'volatilité normale' if vix_val > 15 else 'faible volatilité, complaisance des marchés'}",
            }
    except Exception:
        pass

    try:
        # 2. S&P 500 vs MA (Market Momentum)
        spy = yf.Ticker("SPY")
        spy_hist = spy.history(period="6mo")
        if len(spy_hist) > 125:
            current = float(spy_hist["Close"].iloc[-1])
            ma125 = float(spy_hist["Close"].rolling(125).mean().iloc[-1])
            pct_above = ((current - ma125) / ma125) * 100
            signals["momentum"] = {
                "value": round(pct_above, 1),
                "label": "Momentum (SPY vs MA125)",
                "signal": "extreme_greed" if pct_above > 10 else "greed" if pct_above > 5 else "neutral" if pct_above > -2 else "fear" if pct_above > -8 else "extreme_fear",
                "score": max(0, min(100, 50 + pct_above * 4)),
                "description": f"SPY est {'+' if pct_above > 0 else ''}{round(pct_above, 1)}% {'au-dessus' if pct_above > 0 else 'en-dessous'} de sa MA125 — {'momentum fortement haussier' if pct_above > 10 else 'tendance haussière établie' if pct_above > 5 else 'zone neutre' if pct_above > -2 else 'correction en cours' if pct_above > -8 else 'marché baissier'}",
            }
    except Exception:
        pass

    try:
        # 3. Market Breadth (% stocks above MA50 proxy via sector leaders)
        breadth_up = 0
        breadth_total = 0
        breadth_tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "JPM", "JNJ", "V",
                           "UNH", "XOM", "PG", "MA", "HD", "COST", "ABBV", "MRK", "PEP", "AVGO"]
        for tk in breadth_tickers:
            try:
                t = yf.Ticker(tk)
                h = t.history(period="3mo")
                if len(h) >= 50:
                    price = float(h["Close"].iloc[-1])
                    ma50 = float(h["Close"].rolling(50).mean().iloc[-1])
                    breadth_total += 1
                    if price > ma50:
                        breadth_up += 1
            except Exception:
                continue
        if breadth_total > 0:
            breadth_pct = (breadth_up / breadth_total) * 100
            signals["breadth"] = {
                "value": round(breadth_pct, 0),
                "label": f"Market Breadth ({breadth_up}/{breadth_total} > MA50)",
                "signal": "extreme_greed" if breadth_pct > 80 else "greed" if breadth_pct > 60 else "neutral" if breadth_pct > 40 else "fear" if breadth_pct > 20 else "extreme_fear",
                "score": round(breadth_pct),
                "description": f"{breadth_up}/{breadth_total} grandes capitalisations au-dessus de leur MA50 — {'large participation haussière' if breadth_pct > 70 else 'participation modérée' if breadth_pct > 50 else 'faible participation, marché sélectif' if breadth_pct > 30 else 'marché en détresse, peu de stocks tiennent'}",
            }
    except Exception:
        pass

    try:
        # 4. Safe Haven Demand (Gold vs SPY 20d performance)
        gold = yf.Ticker("GLD")
        gold_h = gold.history(period="1mo")
        spy_h = spy_hist if 'spy_hist' in dir() else yf.Ticker("SPY").history(period="1mo")
        if len(gold_h) >= 15 and len(spy_h) >= 15:
            gold_ret = ((float(gold_h["Close"].iloc[-1]) - float(gold_h["Close"].iloc[0])) / float(gold_h["Close"].iloc[0])) * 100
            spy_ret = ((float(spy_h["Close"].iloc[-1]) - float(spy_h["Close"].iloc[0])) / float(spy_h["Close"].iloc[0])) * 100
            diff = spy_ret - gold_ret  # positive = stocks beating gold = greed
            signals["safe_haven"] = {
                "value": round(diff, 1),
                "label": "Safe Haven (SPY vs Gold 1M)",
                "signal": "extreme_greed" if diff > 5 else "greed" if diff > 2 else "neutral" if diff > -2 else "fear" if diff > -5 else "extreme_fear",
                "score": max(0, min(100, 50 + diff * 8)),
                "description": f"Actions {'surperforment' if diff > 0 else 'sous-performent'} l'or de {abs(round(diff, 1))}% sur 1 mois — {'risk-on, appétit pour le risque' if diff > 3 else 'légère préférence pour le risque' if diff > 0 else 'fuite vers les valeurs refuges' if diff > -3 else 'panique, forte demande de safe haven'}",
            }
    except Exception:
        pass

    try:
        # 5. Put/Call Ratio via major indices
        spy_opt = yf.Ticker("SPY")
        if spy_opt.options:
            chain = spy_opt.option_chain(spy_opt.options[0])
            def _safe_sum(df, col):
                try:
                    vals = df[col].dropna()
                    return int(vals.sum()) if len(vals) > 0 else 0
                except Exception:
                    return 0
            call_vol = _safe_sum(chain.calls, "volume")
            put_vol = _safe_sum(chain.puts, "volume")
            if call_vol > 0:
                pcr = round(put_vol / call_vol, 2)
                signals["put_call"] = {
                    "value": pcr,
                    "label": f"Put/Call Ratio SPY ({pcr})",
                    "signal": "extreme_fear" if pcr > 1.5 else "fear" if pcr > 1.0 else "neutral" if pcr > 0.7 else "greed" if pcr > 0.5 else "extreme_greed",
                    "score": max(0, min(100, 100 - (pcr - 0.5) * 80)),
                    "description": f"Put/Call ratio SPY de {pcr} — {'panique, les traders achètent massivement des protections' if pcr > 1.5 else 'sentiment prudent, demande élevée de puts' if pcr > 1.0 else 'ratio équilibré' if pcr > 0.7 else 'optimisme dominant, peu de couverture' if pcr > 0.5 else 'euphorie extrême, aucune protection'}",
                }
    except Exception:
        pass

    # Composite score
    if signals:
        composite = round(sum(s["score"] for s in signals.values()) / len(signals))
    else:
        composite = 50

    if composite >= 80:
        verdict = "EXTREME GREED"
        color = "red"
        advice = "Euphorie sur les marchés. Historiquement, les périodes d'avidité extrême précèdent souvent des corrections. Soyez prudent, prenez des profits partiels et évitez le FOMO."
    elif composite >= 60:
        verdict = "GREED"
        color = "green"
        advice = "Sentiment haussier dominant. Les marchés sont confiants mais pas encore dans l'excès. Maintenez vos positions mais gardez du cash pour profiter d'un éventuel pullback."
    elif composite >= 40:
        verdict = "NEUTRAL"
        color = "yellow"
        advice = "Sentiment mitigé. Ni peur ni avidité excessive. C'est souvent un bon moment pour analyser les fondamentaux et se positionner sélectivement."
    elif composite >= 20:
        verdict = "FEAR"
        color = "yellow"
        advice = "La peur domine les marchés. Pour les investisseurs long-terme, c'est historiquement un meilleur point d'entrée que pendant les phases d'euphorie. 'Be greedy when others are fearful.'"
    else:
        verdict = "EXTREME FEAR"
        color = "green"
        advice = "Panique généralisée. Warren Buffett dirait d'acheter. Les marchés en panique créent les meilleures opportunités pour les investisseurs patients avec un horizon long terme."

    return _sanitize({
        "composite_score": composite,
        "verdict": verdict,
        "color": color,
        "advice": advice,
        "signals": signals,
    })


# =========================================================
# INSIDER BUY SCREENER
# =========================================================

@app.get("/insider-screener")
def insider_buy_screener():
    """Scan stocks for recent insider buying clusters."""
    scan_tickers = []
    seen = set()
    for tickers_list in SCREENER_SECTORS.values():
        for t in tickers_list:
            if t not in seen:
                scan_tickers.append(t)
                seen.add(t)
    # Add mega caps
    for t in ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD", "NFLX", "CRM", "ORCL", "INTC"]:
        if t not in seen:
            scan_tickers.append(t)
            seen.add(t)

    results = []

    def _scan_insider(tk):
        try:
            resp = finnhub_get("/stock/insider-transactions", {"symbol": tk, "from": (datetime.date.today() - datetime.timedelta(days=90)).strftime("%Y-%m-%d")})
            if not resp:
                return None
            txns = resp.get("data", [])
            if not txns:
                return None

            buys = [t for t in txns if (t.get("transactionType") or "").lower() in ("p - purchase", "purchase", "p")]
            sells = [t for t in txns if (t.get("transactionType") or "").lower() in ("s - sale", "sale", "s")]

            if not buys:
                return None

            total_buy_value = 0
            buy_count = len(buys)
            unique_buyers = set()
            for b in buys:
                shares = abs(b.get("share", 0) or 0)
                price = b.get("transactionPrice") or 0
                total_buy_value += shares * price
                name = b.get("name", "Unknown")
                unique_buyers.add(name)

            total_sell_value = 0
            for s in sells:
                shares = abs(s.get("share", 0) or 0)
                price = s.get("transactionPrice") or 0
                total_sell_value += shares * price

            # Only include if meaningful buying
            if total_buy_value < 50000:
                return None

            # Conviction score
            conviction = 0
            if total_buy_value > 1_000_000:
                conviction += 40
            elif total_buy_value > 500_000:
                conviction += 30
            elif total_buy_value > 100_000:
                conviction += 20
            else:
                conviction += 10

            if len(unique_buyers) >= 3:
                conviction += 30  # cluster buying
            elif len(unique_buyers) >= 2:
                conviction += 20
            else:
                conviction += 10

            if total_sell_value == 0:
                conviction += 20  # no selling at all
            elif total_buy_value > total_sell_value * 2:
                conviction += 10

            # Recency bonus
            latest_buy_date = max(b.get("transactionDate", "") for b in buys)
            try:
                days_since = (datetime.date.today() - datetime.date.fromisoformat(latest_buy_date)).days
                if days_since < 7:
                    conviction += 10
                elif days_since < 14:
                    conviction += 5
            except Exception:
                pass

            return {
                "ticker": tk,
                "buy_count": buy_count,
                "unique_buyers": len(unique_buyers),
                "total_buy_value": round(total_buy_value),
                "total_sell_value": round(total_sell_value),
                "conviction_score": min(100, conviction),
                "latest_buy": latest_buy_date,
                "buyers": list(unique_buyers)[:5],
            }
        except Exception:
            return None

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(_scan_insider, tk): tk for tk in scan_tickers}
        for f in as_completed(futures):
            try:
                result = f.result(timeout=10)
                if result:
                    results.append(result)
            except Exception:
                pass

    results.sort(key=lambda x: x["conviction_score"], reverse=True)

    # AI Summary
    if results:
        top = results[0]
        summary = (
            f"{len(results)} stocks avec des achats d'insiders significatifs sur les 90 derniers jours. "
            f"Le signal le plus fort est sur {top['ticker']} avec {top['unique_buyers']} insiders distincts "
            f"ayant acheté pour ${top['total_buy_value']:,} au total (score de conviction: {top['conviction_score']}/100). "
        )
        cluster_buys = [r for r in results if r["unique_buyers"] >= 3]
        if cluster_buys:
            summary += f"Achats en cluster (3+ insiders) détectés sur: {', '.join(r['ticker'] for r in cluster_buys[:5])}. Les clusters d'achats d'insiders sont historiquement un des signaux les plus fiables de surperformance future."
    else:
        summary = "Aucun achat d'insider significatif détecté sur les 90 derniers jours dans l'univers scanné."

    return _sanitize({
        "results": results[:20],
        "total_found": len(results),
        "ai_summary": summary,
    })


# =========================================================
# AI DAILY BRIEFING
# =========================================================

@app.get("/daily-briefing")
def daily_briefing():
    """Generate a comprehensive daily market briefing."""
    today = datetime.date.today()
    sections = []

    # 1. Major indices
    indices_data = {}
    for name, ticker in [("S&P 500", "^GSPC"), ("Nasdaq", "^IXIC"), ("Dow Jones", "^DJI"), ("Russell 2000", "^RUT"), ("VIX", "^VIX")]:
        try:
            t = yf.Ticker(ticker)
            h = t.history(period="5d")
            if len(h) >= 2:
                current = round(float(h["Close"].iloc[-1]), 2)
                prev = float(h["Close"].iloc[-2])
                change = round(((current - prev) / prev) * 100, 2)
                indices_data[name] = {"price": current, "change_pct": change}
        except Exception:
            continue

    if indices_data:
        sections.append({
            "title": "Indices Majeurs",
            "type": "indices",
            "data": indices_data,
        })

    # 2. Sector movers (from screener sectors)
    sector_moves = {}
    for sector, tickers in list(SCREENER_SECTORS.items())[:6]:
        sector_changes = []
        for tk in tickers[:5]:
            try:
                t = yf.Ticker(tk)
                h = t.history(period="2d")
                if len(h) >= 2:
                    change = ((float(h["Close"].iloc[-1]) - float(h["Close"].iloc[-2])) / float(h["Close"].iloc[-2])) * 100
                    sector_changes.append({"ticker": tk, "change": round(change, 2)})
            except Exception:
                continue
        if sector_changes:
            avg = round(sum(s["change"] for s in sector_changes) / len(sector_changes), 2)
            best = max(sector_changes, key=lambda x: x["change"])
            worst = min(sector_changes, key=lambda x: x["change"])
            sector_moves[sector] = {
                "avg_change": avg,
                "best": best,
                "worst": worst,
            }

    if sector_moves:
        sections.append({
            "title": "Performance Sectorielle",
            "type": "sectors",
            "data": dict(sorted(sector_moves.items(), key=lambda x: x[1]["avg_change"], reverse=True)),
        })

    # 3. Top movers in universe
    all_movers = []
    scan_tickers = list(set(tk for tl in SCREENER_SECTORS.values() for tk in tl))[:60]
    def _get_change(tk):
        try:
            t = yf.Ticker(tk)
            h = t.history(period="2d")
            if len(h) >= 2:
                price = round(float(h["Close"].iloc[-1]), 2)
                change = round(((float(h["Close"].iloc[-1]) - float(h["Close"].iloc[-2])) / float(h["Close"].iloc[-2])) * 100, 2)
                return {"ticker": tk, "price": price, "change_pct": change}
        except Exception:
            pass
        return None

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(_get_change, tk) for tk in scan_tickers]
        for f in as_completed(futures):
            try:
                r = f.result(timeout=10)
                if r:
                    all_movers.append(r)
            except Exception:
                pass

    if all_movers:
        all_movers.sort(key=lambda x: x["change_pct"], reverse=True)
        sections.append({
            "title": "Top Movers",
            "type": "movers",
            "data": {
                "gainers": all_movers[:5],
                "losers": all_movers[-5:][::-1],
            },
        })

    # 4. Economic events today
    try:
        cal = economic_calendar(days=1)
        today_events = [e for e in cal.get("events", []) if e["date"] == today.strftime("%Y-%m-%d")]
        if today_events:
            sections.append({
                "title": "Événements du Jour",
                "type": "events",
                "data": today_events,
            })
    except Exception:
        pass

    # Generate AI summary
    summary_parts = [f"Briefing marché du {today.strftime('%d/%m/%Y')}."]

    if indices_data:
        sp = indices_data.get("S&P 500", {})
        nq = indices_data.get("Nasdaq", {})
        vix_d = indices_data.get("VIX", {})
        if sp:
            direction = "hausse" if sp.get("change_pct", 0) > 0 else "baisse"
            summary_parts.append(f"S&P 500 en {direction} de {abs(sp.get('change_pct', 0))}%.")
        if vix_d:
            if vix_d.get("price", 15) > 25:
                summary_parts.append(f"VIX élevé à {vix_d['price']} — volatilité accrue, prudence recommandée.")
            elif vix_d.get("price", 15) < 15:
                summary_parts.append(f"VIX bas à {vix_d['price']} — marchés calmes, potentiel de complaisance.")

    if sector_moves:
        best_sector = max(sector_moves.items(), key=lambda x: x[1]["avg_change"])
        worst_sector = min(sector_moves.items(), key=lambda x: x[1]["avg_change"])
        summary_parts.append(
            f"Meilleur secteur: {best_sector[0]} ({'+' if best_sector[1]['avg_change'] > 0 else ''}{best_sector[1]['avg_change']}%). "
            f"Pire secteur: {worst_sector[0]} ({'+' if worst_sector[1]['avg_change'] > 0 else ''}{worst_sector[1]['avg_change']}%)."
        )

    if all_movers:
        summary_parts.append(
            f"Plus forte hausse: {all_movers[0]['ticker']} (+{all_movers[0]['change_pct']}%). "
            f"Plus forte baisse: {all_movers[-1]['ticker']} ({all_movers[-1]['change_pct']}%)."
        )

    return _sanitize({
        "date": today.strftime("%Y-%m-%d"),
        "sections": sections,
        "ai_summary": " ".join(summary_parts),
    })


# =========================================================
# FAIR VALUE / DCF CALCULATOR
# =========================================================

@app.get("/fair-value/{ticker}")
def fair_value(ticker: str):
    """Compute fair value estimate using multiple valuation methods."""
    ticker = resolve_ticker(ticker)
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
    except Exception:
        raise HTTPException(status_code=404, detail=f"Cannot fetch data for {ticker}")

    fundamentals = get_fundamentals(ticker)
    profile = get_company_profile(ticker)
    name = (profile or {}).get("name", ticker)
    current_price = info.get("currentPrice") or info.get("regularMarketPrice") or 0
    currency = info.get("currency", "USD")

    methods = []

    # 1. PE-based valuation
    eps = info.get("trailingEps")
    fwd_eps = info.get("forwardEps")
    sector_pe = info.get("sectorPE") or 22  # fallback S&P avg
    if eps and eps > 0:
        pe_fair = round(eps * sector_pe, 2)
        methods.append({
            "name": "PE Relative (Sector Avg)",
            "value": pe_fair,
            "detail": f"EPS trailing ${eps:.2f} x PE sector ~{sector_pe}",
            "confidence": "medium",
        })
    if fwd_eps and fwd_eps > 0:
        fwd_pe_fair = round(fwd_eps * sector_pe, 2)
        methods.append({
            "name": "Forward PE",
            "value": fwd_pe_fair,
            "detail": f"EPS forward ${fwd_eps:.2f} x PE sector ~{sector_pe}",
            "confidence": "medium",
        })

    # 2. DCF simplified (using FCF growth)
    fcf = info.get("freeCashflow")
    shares = info.get("sharesOutstanding")
    rev_growth = fundamentals.get("revenue_growth") if fundamentals else None
    if fcf and shares and shares > 0 and fcf > 0:
        growth_rate = min((rev_growth or 10) / 100, 0.25)  # cap at 25%
        discount_rate = 0.10
        terminal_growth = 0.03
        fcf_per_share = fcf / shares
        dcf_value = 0
        projected_fcf = fcf_per_share
        for yr in range(1, 11):
            g = growth_rate if yr <= 5 else (growth_rate + terminal_growth) / 2
            projected_fcf *= (1 + g)
            dcf_value += projected_fcf / ((1 + discount_rate) ** yr)
        # Terminal value
        terminal_val = projected_fcf * (1 + terminal_growth) / (discount_rate - terminal_growth)
        dcf_value += terminal_val / ((1 + discount_rate) ** 10)
        dcf_value = round(dcf_value, 2)
        methods.append({
            "name": "DCF (10Y Projection)",
            "value": dcf_value,
            "detail": f"FCF/share ${fcf_per_share:.2f}, growth {growth_rate*100:.0f}%, discount 10%",
            "confidence": "medium",
        })

    # 3. Price/Sales based
    revenue = info.get("totalRevenue")
    if revenue and shares and shares > 0:
        rev_per_share = revenue / shares
        # Use sector-appropriate P/S
        ps_ratio = info.get("priceToSalesTrailing12Months") or 5
        sector_ps = max(1, ps_ratio * 0.8)  # slight discount for fair value
        ps_fair = round(rev_per_share * sector_ps, 2)
        methods.append({
            "name": "Price/Sales",
            "value": ps_fair,
            "detail": f"Revenue/share ${rev_per_share:.2f} x P/S {sector_ps:.1f}",
            "confidence": "low" if ps_ratio > 15 else "medium",
        })

    # 4. Analyst target price
    target = info.get("targetMeanPrice")
    target_low = info.get("targetLowPrice")
    target_high = info.get("targetHighPrice")
    n_analysts = info.get("numberOfAnalystOpinions", 0)
    if target:
        methods.append({
            "name": f"Analyst Consensus ({n_analysts} analysts)",
            "value": round(target, 2),
            "detail": f"Range: ${target_low or '?'} — ${target_high or '?'}",
            "confidence": "high" if n_analysts >= 10 else "medium" if n_analysts >= 3 else "low",
        })

    # 5. Book value
    book = info.get("bookValue")
    if book and book > 0:
        methods.append({
            "name": "Book Value",
            "value": round(book, 2),
            "detail": f"Tangible book value per share",
            "confidence": "low",
        })

    # Composite fair value (weighted average)
    if methods:
        weight_map = {"high": 3, "medium": 2, "low": 1}
        total_w = sum(weight_map.get(m["confidence"], 1) for m in methods)
        composite = round(sum(m["value"] * weight_map.get(m["confidence"], 1) for m in methods) / total_w, 2)
    else:
        composite = None

    # Upside/downside
    upside = round(((composite - current_price) / current_price) * 100, 1) if composite and current_price > 0 else None

    # AI Summary
    if composite and current_price > 0:
        if upside and upside > 20:
            verdict = "SOUS-ÉVALUÉ"
            summary = f"Notre estimation composite de fair value pour {ticker} est de ${composite}, soit {upside}% au-dessus du prix actuel de ${current_price:.2f}. Selon nos {len(methods)} modèles de valorisation, le titre présente un potentiel de hausse significatif. "
        elif upside and upside > 5:
            verdict = "LÉGÈREMENT SOUS-ÉVALUÉ"
            summary = f"Fair value estimée à ${composite} vs prix actuel ${current_price:.2f} ({upside}% upside). Le titre se négocie en-dessous de sa valeur intrinsèque estimée, avec une marge de sécurité modérée. "
        elif upside and upside > -10:
            verdict = "CORRECTEMENT VALORISÉ"
            summary = f"Fair value estimée à ${composite} vs prix actuel ${current_price:.2f} ({upside}%). Le titre se négocie proche de sa valeur intrinsèque — ni sur-évalué ni sous-évalué. "
        else:
            verdict = "SUR-ÉVALUÉ"
            summary = f"Fair value estimée à ${composite} vs prix actuel ${current_price:.2f} ({upside}%). Le prix actuel dépasse notre estimation de valeur intrinsèque. Prudence recommandée — une correction vers la fair value est possible. "

        if target:
            summary += f"Les analystes Wall Street visent ${target} en moyenne ({n_analysts} analystes)."
    else:
        verdict = "DONNÉES INSUFFISANTES"
        summary = f"Pas assez de données financières pour estimer une fair value fiable pour {ticker}."

    return _sanitize({
        "ticker": ticker,
        "name": name,
        "current_price": round(current_price, 2) if current_price else None,
        "currency": currency,
        "composite_fair_value": composite,
        "upside_pct": upside,
        "verdict": verdict,
        "methods": methods,
        "analyst_target": {"mean": target, "low": target_low, "high": target_high, "count": n_analysts} if target else None,
        "ai_summary": summary if composite else "Données insuffisantes pour l'analyse de valorisation.",
    })


# =========================================================
# SWOT ANALYSIS
# =========================================================

@app.get("/swot/{ticker}")
def swot_analysis(ticker: str):
    """Generate a data-driven SWOT analysis."""
    ticker = resolve_ticker(ticker)
    fundamentals = get_fundamentals(ticker)
    technicals = get_technicals(ticker)
    profile = get_company_profile(ticker)

    if not profile or not profile.get("name"):
        raise HTTPException(status_code=404, detail=f"Cannot analyze {ticker}")

    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
    except Exception:
        info = {}

    name = profile.get("name", ticker)
    industry = profile.get("industry", "")
    strengths, weaknesses, opportunities, threats = [], [], [], []

    # === STRENGTHS ===
    rev_growth = fundamentals.get("revenue_growth") if fundamentals else None
    if rev_growth and rev_growth > 20:
        strengths.append(f"Forte croissance du CA: +{rev_growth:.0f}% YoY — bien au-dessus du marché")
    elif rev_growth and rev_growth > 10:
        strengths.append(f"Croissance solide du CA: +{rev_growth:.0f}% YoY")

    margin = fundamentals.get("profit_margin") if fundamentals else None
    if margin and margin > 20:
        strengths.append(f"Marges bénéficiaires élevées ({margin:.0f}%) — fort pricing power")
    elif margin and margin > 10:
        strengths.append(f"Marges bénéficiaires saines ({margin:.0f}%)")

    roe = info.get("returnOnEquity")
    if roe and roe > 0.20:
        strengths.append(f"ROE excellent ({roe*100:.0f}%) — utilisation efficace des capitaux propres")

    debt_eq = info.get("debtToEquity")
    if debt_eq is not None and debt_eq < 50:
        strengths.append(f"Faible endettement (D/E: {debt_eq:.0f}%) — bilan solide")

    mcap = info.get("marketCap", 0)
    if mcap and mcap > 100_000_000_000:
        strengths.append("Mega-cap: liquidité maximale et accès au capital facilité")

    rsi = technicals.get("rsi") if technicals else None
    ma50_pos = technicals.get("price_vs_ma50") if technicals else None
    if ma50_pos == "above" and rsi and 50 < rsi < 70:
        strengths.append("Momentum technique positif — au-dessus de la MA50 avec RSI sain")

    fcf = info.get("freeCashflow", 0)
    if fcf and fcf > 0:
        strengths.append(f"Free Cash Flow positif (${fcf/1e9:.1f}B) — autofinancement assuré")

    # === WEAKNESSES ===
    if rev_growth is not None and rev_growth < 0:
        weaknesses.append(f"CA en déclin ({rev_growth:.0f}% YoY) — perte de momentum")
    elif rev_growth is not None and rev_growth < 5:
        weaknesses.append(f"Croissance faible ({rev_growth:.0f}% YoY) — difficulté à accélérer")

    if margin is not None and margin < 0:
        weaknesses.append(f"Entreprise non-profitable (marge nette: {margin:.0f}%)")
    elif margin is not None and margin < 5:
        weaknesses.append(f"Marges faibles ({margin:.0f}%) — vulnérable aux pressions sur les coûts")

    pe = fundamentals.get("pe_ratio") if fundamentals else None
    if pe and pe > 50:
        weaknesses.append(f"Valorisation tendue (PE: {pe:.0f}x) — peu de marge d'erreur")
    elif pe and pe > 35:
        weaknesses.append(f"Valorisation élevée (PE: {pe:.0f}x) — expectations déjà intégrées")

    if debt_eq is not None and debt_eq > 150:
        weaknesses.append(f"Endettement élevé (D/E: {debt_eq:.0f}%) — risque de refinancement")

    if rsi and rsi > 75:
        weaknesses.append(f"RSI en surachat ({rsi:.0f}) — pullback technique probable à court terme")

    if fcf and fcf < 0:
        weaknesses.append(f"Free Cash Flow négatif — dépendance au financement externe")

    beta = info.get("beta")
    if beta and beta > 1.5:
        weaknesses.append(f"Volatilité élevée (Beta: {beta:.1f}) — amplifie les mouvements de marché")

    # === OPPORTUNITIES ===
    # Check sector catalysts
    stock_sector = None
    for s, tl in SCREENER_SECTORS.items():
        if ticker in tl:
            stock_sector = s
            break
    catalysts = SECTOR_CATALYSTS.get(stock_sector, []) if stock_sector else []
    for cat in catalysts[:2]:
        if cat.get("impact") in ("very_high", "high"):
            opportunities.append(f"Catalyseur: {cat['event']} ({cat['date']}) — {cat.get('description', '')[:100]}")

    target = info.get("targetMeanPrice")
    current = info.get("currentPrice") or 0
    if target and current and target > current * 1.15:
        opportunities.append(f"Consensus analyste: objectif ${target:.0f} (+{((target-current)/current*100):.0f}% upside)")

    if rev_growth and rev_growth > 15:
        opportunities.append("Trajectoire de croissance permet l'expansion des multiples")

    fwd_pe = fundamentals.get("forward_pe") if fundamentals else None
    if pe and fwd_pe and fwd_pe < pe * 0.8:
        opportunities.append(f"Compression PE attendue ({pe:.0f}x → {fwd_pe:.0f}x) — earnings en accélération")

    tam = info.get("totalRevenue", 0)
    if tam and mcap and mcap < tam * 8 and rev_growth and rev_growth > 20:
        opportunities.append("Pénétration de marché encore faible avec un TAM en expansion")

    # === THREATS ===
    if rsi and rsi < 30:
        threats.append(f"RSI en survente ({rsi:.0f}) — momentum baissier établi")

    ma200_pos = technicals.get("price_vs_ma200") if technicals else None
    if ma200_pos == "below":
        threats.append("Prix sous la MA200 — tendance baissière long terme")

    if beta and beta > 2:
        threats.append(f"Beta très élevé ({beta:.1f}) — extrêmement sensible aux corrections de marché")

    if pe and pe > 60:
        threats.append("Valorisation extrême — toute déception sur les résultats peut provoquer un décrochage de -20%+")

    if debt_eq and debt_eq > 200:
        threats.append("Risque de dette significatif — vulnérable en cas de hausse des taux")

    short_pct = info.get("shortPercentOfFloat")
    if short_pct and short_pct > 10:
        threats.append(f"Short interest élevé ({short_pct:.0f}% du float) — pression vendeuse institutionnelle")

    if not opportunities:
        opportunities.append("Pas de catalyseur sectoriel identifié à court terme")
    if not threats:
        threats.append("Risques macro standards: taux d'intérêt, récession, géopolitique")
    if not strengths:
        strengths.append("Données insuffisantes pour identifier des forces claires")
    if not weaknesses:
        weaknesses.append("Aucune faiblesse majeure identifiée avec les données disponibles")

    return _sanitize({
        "ticker": ticker,
        "name": name,
        "industry": industry,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "opportunities": opportunities,
        "threats": threats,
    })


# =========================================================
# FINANCIAL STATEMENTS
# =========================================================

@app.get("/financials/{ticker}")
def financial_statements(ticker: str):
    """Get income statement, balance sheet, and cash flow data."""
    ticker = resolve_ticker(ticker)
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
    except Exception:
        raise HTTPException(status_code=404, detail=f"Cannot fetch {ticker}")

    result = {"ticker": ticker, "name": info.get("shortName", ticker), "currency": info.get("currency", "USD")}

    # Income Statement
    try:
        inc = t.income_stmt
        if inc is not None and not inc.empty:
            rows = []
            for col in inc.columns[:4]:  # last 4 years
                period = str(col.date()) if hasattr(col, 'date') else str(col)
                row = {"period": period}
                for idx in inc.index:
                    val = inc.loc[idx, col]
                    if val is not None and not (isinstance(val, float) and val != val):
                        row[str(idx)] = float(val)
                rows.append(row)
            result["income_statement"] = rows
    except Exception:
        result["income_statement"] = []

    # Balance Sheet
    try:
        bs = t.balance_sheet
        if bs is not None and not bs.empty:
            rows = []
            for col in bs.columns[:4]:
                period = str(col.date()) if hasattr(col, 'date') else str(col)
                row = {"period": period}
                for idx in bs.index:
                    val = bs.loc[idx, col]
                    if val is not None and not (isinstance(val, float) and val != val):
                        row[str(idx)] = float(val)
                rows.append(row)
            result["balance_sheet"] = rows
    except Exception:
        result["balance_sheet"] = []

    # Cash Flow
    try:
        cf = t.cashflow
        if cf is not None and not cf.empty:
            rows = []
            for col in cf.columns[:4]:
                period = str(col.date()) if hasattr(col, 'date') else str(col)
                row = {"period": period}
                for idx in cf.index:
                    val = cf.loc[idx, col]
                    if val is not None and not (isinstance(val, float) and val != val):
                        row[str(idx)] = float(val)
                rows.append(row)
            result["cash_flow"] = rows
    except Exception:
        result["cash_flow"] = []

    return _sanitize(result)


# =========================================================
# STOCK COMPARISON
# =========================================================

@app.get("/compare")
def compare_stocks(tickers: str):
    """Compare multiple stocks side-by-side. tickers= comma-separated."""
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()][:6]
    if len(ticker_list) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 tickers (comma-separated)")

    results = []
    for tk in ticker_list:
        try:
            t = yf.Ticker(resolve_ticker(tk))
            info = t.info or {}
            hist = t.history(period="1y")

            price = info.get("currentPrice") or info.get("regularMarketPrice") or 0
            prev = info.get("previousClose") or 0
            change_pct = round(((price - prev) / prev) * 100, 2) if prev > 0 else 0

            # 1Y return
            ret_1y = None
            if not hist.empty and len(hist) > 50:
                ret_1y = round(((float(hist["Close"].iloc[-1]) - float(hist["Close"].iloc[0])) / float(hist["Close"].iloc[0])) * 100, 1)

            results.append({
                "ticker": tk,
                "name": info.get("shortName", tk),
                "price": round(float(price), 2) if price else None,
                "change_pct": change_pct,
                "market_cap": info.get("marketCap"),
                "pe_ratio": round(float(info["trailingPE"]), 1) if info.get("trailingPE") else None,
                "forward_pe": round(float(info["forwardPE"]), 1) if info.get("forwardPE") else None,
                "revenue_growth": round(info.get("revenueGrowth", 0) * 100, 1) if info.get("revenueGrowth") else None,
                "profit_margin": round(info.get("profitMargins", 0) * 100, 1) if info.get("profitMargins") else None,
                "roe": round(info.get("returnOnEquity", 0) * 100, 1) if info.get("returnOnEquity") else None,
                "debt_to_equity": round(float(info["debtToEquity"]), 0) if info.get("debtToEquity") else None,
                "dividend_yield": round(info.get("dividendYield", 0) * 100, 2) if info.get("dividendYield") else None,
                "beta": round(float(info["beta"]), 2) if info.get("beta") else None,
                "rsi": round(float(get_technicals(tk).get("rsi", 0)), 1) if get_technicals(tk) else None,
                "return_1y": ret_1y,
                "eps": round(float(info["trailingEps"]), 2) if info.get("trailingEps") else None,
                "fcf": info.get("freeCashflow"),
                "analyst_target": info.get("targetMeanPrice"),
                "analyst_count": info.get("numberOfAnalystOpinions", 0),
            })
        except Exception:
            results.append({"ticker": tk, "name": tk, "error": True})

    return _sanitize({"tickers": ticker_list, "results": results})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
