//+------------------------------------------------------------------+
//|                                                ${FILE_NAME}      |
//|                        Copyright ${YEAR}, ${AUTHOR}              |
//|                                             ${LINK}              |
//+------------------------------------------------------------------+
#property copyright "Copyright ${YEAR}, ${AUTHOR}"
#property link      "${LINK}"
#property version   "1.00"
#property strict
#property show_inputs

//--- Input parameters
input string InpSymbol = "";       // Symbol (empty = current)
input bool   InpConfirm = true;    // Show confirmation

//+------------------------------------------------------------------+
//| Script program start function                                    |
//+------------------------------------------------------------------+
void OnStart()
{
   //--- Get symbol
   string symbol = InpSymbol == "" ? Symbol() : InpSymbol;
   
   //--- Show confirmation if enabled
   if(InpConfirm)
   {
      if(MessageBox("Run script on " + symbol + "?", "Confirm", MB_YESNO | MB_ICONQUESTION) != IDYES)
         return;
   }
   
   //--- Your script logic here
   Print("Script started on ", symbol);
   
   //--- Example: Print symbol information
   Print("Symbol: ", symbol);
   Print("Bid: ", MarketInfo(symbol, MODE_BID));
   Print("Ask: ", MarketInfo(symbol, MODE_ASK));
   Print("Spread: ", MarketInfo(symbol, MODE_SPREAD));
   Print("Point: ", MarketInfo(symbol, MODE_POINT));
   
   Print("Script completed successfully");
}
//+------------------------------------------------------------------+
