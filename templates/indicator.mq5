//+------------------------------------------------------------------+
//|                                                ${FILE_NAME}      |
//|                        Copyright ${YEAR}, ${AUTHOR}              |
//|                                             ${LINK}              |
//+------------------------------------------------------------------+
#property copyright "Copyright ${YEAR}, ${AUTHOR}"
#property link      "${LINK}"
#property version   "1.00"
#property indicator_chart_window
#property indicator_buffers 2
#property indicator_plots   2

//--- Plot settings
#property indicator_label1  "Line1"
#property indicator_type1   DRAW_LINE
#property indicator_color1  clrDodgerBlue
#property indicator_style1  STYLE_SOLID
#property indicator_width1  2

#property indicator_label2  "Line2"
#property indicator_type2   DRAW_LINE
#property indicator_color2  clrRed
#property indicator_style2  STYLE_SOLID
#property indicator_width2  2

//--- Input parameters
input int    InpPeriod1 = 14;    // First period
input int    InpPeriod2 = 28;    // Second period
input ENUM_MA_METHOD InpMAMethod = MODE_SMA; // MA Method

//--- Indicator buffers
double Buffer1[];
double Buffer2[];

//--- Indicator handles
int handleMA1;
int handleMA2;

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
   //--- Indicator buffers mapping
   SetIndexBuffer(0, Buffer1, INDICATOR_DATA);
   SetIndexBuffer(1, Buffer2, INDICATOR_DATA);
   
   //--- Set arrays as timeseries
   ArraySetAsSeries(Buffer1, true);
   ArraySetAsSeries(Buffer2, true);
   
   //--- Create MA handles
   handleMA1 = iMA(Symbol(), Period(), InpPeriod1, 0, InpMAMethod, PRICE_CLOSE);
   handleMA2 = iMA(Symbol(), Period(), InpPeriod2, 0, InpMAMethod, PRICE_CLOSE);
   
   if(handleMA1 == INVALID_HANDLE || handleMA2 == INVALID_HANDLE)
   {
      Print("Error creating indicator handles");
      return(INIT_FAILED);
   }
   
   //--- Name for indicator window
   IndicatorSetString(INDICATOR_SHORTNAME, "Custom Indicator(" + 
                      IntegerToString(InpPeriod1) + "," + 
                      IntegerToString(InpPeriod2) + ")");
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Custom indicator deinitialization function                       |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   //--- Release indicator handles
   if(handleMA1 != INVALID_HANDLE)
      IndicatorRelease(handleMA1);
   if(handleMA2 != INVALID_HANDLE)
      IndicatorRelease(handleMA2);
}

//+------------------------------------------------------------------+
//| Custom indicator iteration function                              |
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
{
   //--- Check for minimum bars
   if(rates_total < MathMax(InpPeriod1, InpPeriod2))
      return(0);
   
   //--- Calculate number of bars to process
   int limit = rates_total - prev_calculated;
   if(prev_calculated > 0)
      limit++;
   
   //--- Copy indicator data
   if(CopyBuffer(handleMA1, 0, 0, limit, Buffer1) <= 0)
      return(0);
   if(CopyBuffer(handleMA2, 0, 0, limit, Buffer2) <= 0)
      return(0);
   
   return(rates_total);
}
//+------------------------------------------------------------------+
