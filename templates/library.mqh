//+------------------------------------------------------------------+
//|                                                ${FILE_NAME}      |
//|                        Copyright ${YEAR}, ${AUTHOR}              |
//|                                             ${LINK}              |
//+------------------------------------------------------------------+
#property copyright "Copyright ${YEAR}, ${AUTHOR}"
#property link      "${LINK}"
#property version   "1.00"
#property library
#property strict

//+------------------------------------------------------------------+
//| Example exported function                                        |
//+------------------------------------------------------------------+
int Add(int a, int b) export
{
   return a + b;
}

//+------------------------------------------------------------------+
//| Example exported function                                        |
//+------------------------------------------------------------------+
double Multiply(double a, double b) export
{
   return a * b;
}

//+------------------------------------------------------------------+
//| Example exported string function                                 |
//+------------------------------------------------------------------+
string Greet(string name) export
{
   return "Hello, " + name + "!";
}

//+------------------------------------------------------------------+
//| Library initialization (optional)                                |
//+------------------------------------------------------------------+
void OnInit()
{
   Print("Library loaded: ${FILE_NAME}");
}

//+------------------------------------------------------------------+
//| Library deinitialization (optional)                              |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("Library unloaded: ${FILE_NAME}");
}
//+------------------------------------------------------------------+
