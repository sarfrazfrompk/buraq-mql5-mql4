//+------------------------------------------------------------------+
//|                                                ${FILE_NAME}      |
//|                        Copyright ${YEAR}, ${AUTHOR}              |
//|                                             ${LINK}              |
//+------------------------------------------------------------------+
#property copyright "Copyright ${YEAR}, ${AUTHOR}"
#property link      "${LINK}"
#property version   "1.00"
#property strict
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
input int    Period1 = 14;    // First period
input int    Period2 = 28;    // Second period
input ENUM_MA_METHOD MAMethod = MODE_SMA; // MA Method

//--- Indicator buffers
double Buffer1[];
double Buffer2[];

//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{
   //--- Indicator buffers mapping
   SetIndexBuffer(0, Buffer1, INDICATOR_DATA);
   SetIndexBuffer(1, Buffer2, INDICATOR_DATA);
   
   //--- Set indicator labels
   SetIndexLabel(0, "Line1(" + IntegerToString(Period1) + ")");
   SetIndexLabel(1, "Line2(" + IntegerToString(Period2) + ")");
   
   //--- Set drawing properties
   SetIndexStyle(0, DRAW_LINE);
   SetIndexStyle(1, DRAW_LINE);
   
   //--- Name for indicator window
   IndicatorShortName("Custom Indicator");
   
   return(INIT_SUCCEEDED);
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
   if(rates_total < MathMax(Period1, Period2))
      return(0);
   
   //--- Calculate starting position
   int start = prev_calculated > 0 ? prev_calculated - 1 : MathMax(Period1, Period2);
   
   //--- Main calculation loop
   for(int i = start; i < rates_total; i++)
   {
      //--- Calculate indicator values
      Buffer1[i] = iMA(Symbol(), Period(), Period1, 0, MAMethod, PRICE_CLOSE, rates_total - 1 - i);
      Buffer2[i] = iMA(Symbol(), Period(), Period2, 0, MAMethod, PRICE_CLOSE, rates_total - 1 - i);
   }
   
   return(rates_total);
}
//+------------------------------------------------------------------+
