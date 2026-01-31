//+------------------------------------------------------------------+
//|                                                ${FILE_NAME}      |
//|                        Copyright ${YEAR}, ${AUTHOR}              |
//|                                             ${LINK}              |
//+------------------------------------------------------------------+
#property copyright "Copyright ${YEAR}, ${AUTHOR}"
#property link      "${LINK}"
#property version   "1.00"
#property strict

//--- Input parameters
input double   LotSize = 0.1;        // Lot size
input int      StopLoss = 50;        // Stop Loss in points
input int      TakeProfit = 100;     // Take Profit in points
input int      MagicNumber = 123456; // Magic Number

//--- Global variables
datetime lastBarTime = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   //--- Initialization code
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
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
      {
         if(OrderSymbol() == Symbol() && OrderMagicNumber() == MagicNumber)
            return true;
      }
   }
   return false;
}

//+------------------------------------------------------------------+
//| Open a buy order                                                 |
//+------------------------------------------------------------------+
bool OpenBuy()
{
   double price = Ask;
   double sl = price - StopLoss * Point;
   double tp = price + TakeProfit * Point;
   
   int ticket = OrderSend(Symbol(), OP_BUY, LotSize, price, 3, sl, tp, 
                          "EA Buy Order", MagicNumber, 0, clrGreen);
   
   if(ticket > 0)
   {
      Print("Buy order opened successfully. Ticket: ", ticket);
      return true;
   }
   else
   {
      Print("Error opening buy order: ", GetLastError());
      return false;
   }
}

//+------------------------------------------------------------------+
//| Open a sell order                                                |
//+------------------------------------------------------------------+
bool OpenSell()
{
   double price = Bid;
   double sl = price + StopLoss * Point;
   double tp = price - TakeProfit * Point;
   
   int ticket = OrderSend(Symbol(), OP_SELL, LotSize, price, 3, sl, tp, 
                          "EA Sell Order", MagicNumber, 0, clrRed);
   
   if(ticket > 0)
   {
      Print("Sell order opened successfully. Ticket: ", ticket);
      return true;
   }
   else
   {
      Print("Error opening sell order: ", GetLastError());
      return false;
   }
}
//+------------------------------------------------------------------+
