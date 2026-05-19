import sys
import ctypes
from ctypes import wintypes
import os
import argparse
import time

HH_DISPLAY_TOPIC = 0
HH_KEYWORD_LOOKUP = 13

class HH_AKLINK(ctypes.Structure):
    _fields_ = [
        ("cbStruct", wintypes.INT),
        ("fReserved", wintypes.BOOL),
        ("pszKeywords", wintypes.LPCWSTR),
        ("pszUrl", wintypes.LPCWSTR),
        ("pszMsgText", wintypes.LPCWSTR),
        ("pszMsgTitle", wintypes.LPCWSTR),
        ("pszWindow", wintypes.LPCWSTR),
        ("fIndexOnFail", wintypes.BOOL)
    ]

def open_chm_keyword(chm_path, keyword):
    if not os.path.exists(chm_path):
        print(f"Error: Help file not found: {chm_path}")
        return

    try:
        hhctrl = ctypes.WinDLL("hhctrl.ocx")
    except Exception as e:
        print(f"Error loading hhctrl.ocx: {e}")
        return

    chm_path_w = os.path.abspath(chm_path)
    aklink = HH_AKLINK()
    aklink.cbStruct = ctypes.sizeof(HH_AKLINK)
    aklink.fReserved = False
    aklink.pszKeywords = keyword
    aklink.pszUrl = None
    aklink.pszMsgText = None
    aklink.pszMsgTitle = None
    aklink.pszWindow = None
    aklink.fIndexOnFail = True

    hwnd = hhctrl.HtmlHelpW(0, chm_path_w, HH_KEYWORD_LOOKUP, ctypes.byref(aklink))
    
    if hwnd:
        user32 = ctypes.windll.user32
        while user32.IsWindow(hwnd):
            time.sleep(0.5)
    else:
        time.sleep(2)

def main():
    parser = argparse.ArgumentParser(description='BuraqKeys - MQL Help Utility')
    parser.add_argument("-Mql", action="store_true")
    parser.add_argument("-#klink", dest="keyword")
    parser.add_argument("chm_file")

    args, unknown = parser.parse_known_args()

    if args.keyword and args.chm_file:
        open_chm_keyword(args.chm_file, args.keyword)
    elif args.chm_file:
        hhctrl = ctypes.WinDLL("hhctrl.ocx")
        hwnd = hhctrl.HtmlHelpW(0, os.path.abspath(args.chm_file), HH_DISPLAY_TOPIC, 0)
        if hwnd:
            user32 = ctypes.windll.user32
            while user32.IsWindow(hwnd):
                time.sleep(0.5)
        else:
            time.sleep(2)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
