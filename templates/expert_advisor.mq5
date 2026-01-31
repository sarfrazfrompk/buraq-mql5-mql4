//+------------------------------------------------------------------+
//|                                                ${FILE_NAME}      |
//|                        Copyright ${YEAR}, ${AUTHOR}              |
//|                                             ${LINK}              |
//+------------------------------------------------------------------+
#property copyright "Copyright ${YEAR}, ${AUTHOR}"
#property link      "${LINK}"
#property version   "1.00"

//--- Input parameters
input double   LotSize = 0.1;        // Lot size
input int      StopLoss = 50;        // Stop Loss in points
input int      TakeProfit = 100;     // Take Profit in points
input ulong    MagicNumber = 123456; // Magic Number

//--- Include trade library
#include <Trade\Trade.mqh>

//--- Global variables
CTrade trade;
datetime lastBarTime = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   //--- Set magic number
   trade.SetExpertMagicNumber(MagicNumber);
   trade.SetDeviationInPoints(10);
   trade.SetTypeFilling(ORDER_FILLING_IOC);
   
   Print("EA initialized successfully");
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   //--- Cleanup code
   Print("EA deinitialized. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   //--- Check for new bar
   datetime currentBarTime = iTime(Symbol(), Period(), 0);
   if(currentBarTime == lastBarTime)
      return;
   lastBarTime = currentBarTime;
   
   //--- Your trading logic here
   
}

//+------------------------------------------------------------------+
//| Check for open positions                                         |
//+------------------------------------------------------------------+
bool HasOpenPosition()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0)
      {
         if(PositionGetString(POSITION_SYMBOL) == Symbol() && 
            PositionGetInteger(POSITION_MAGIC) == MagicNumber)
            return true;
      }
   }
   return false;
}

//+------------------------------------------------------------------+
//| Open a buy position                                              |
//+------------------------------------------------------------------+
bool OpenBuy()
{
   double price = SymbolInfoDouble(Symbol(), SYMBOL_ASK);
   double sl = price - StopLoss * SymbolInfoDouble(Symbol(), SYMBOL_POINT);
   double tp = price + TakeProfit * SymbolInfoDouble(Symbol(), SYMBOL_POINT);
   
   if(trade.Buy(LotSize, Symbol(), price, sl, tp, "EA Buy Order"))
   {
      Print("Buy position opened successfully");
      return true;
   }
   else
   {
      Print("Error opening buy position: ", trade.ResultRetcode());
      return false;
   }
}

//+------------------------------------------------------------------+
//| Open a sell position                                             |
//+------------------------------------------------------------------+
bool OpenSell()
{
   double price = SymbolInfoDouble(Symbol(), SYMBOL_BID);
   double sl = price + StopLoss * SymbolInfoDouble(Symbol(), SYMBOL_POINT);
   double tp = price - TakeProfit * SymbolInfoDouble(Symbol(), SYMBOL_POINT);
   
   if(trade.Sell(LotSize, Symbol(), price, sl, tp, "EA Sell Order"))
   {
      Print("Sell position opened successfully");
      return true;
   }
   else
   {
      Print("Error opening sell position: ", trade.ResultRetcode());
      return false;
   }
}
//+------------------------------------------------------------------+
