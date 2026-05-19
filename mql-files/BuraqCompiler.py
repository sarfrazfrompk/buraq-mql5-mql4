import sys
import os
import time
import ctypes
from ctypes import wintypes

SW_MINIMIZE = 6
WM_CLOSE = 16
SC_CLOSE = 0xF060
WM_DESTROY = 2

EnumWindowsProc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

def get_window_process_name(hwnd):
    pid = wintypes.DWORD()
    ctypes.windll.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    PROCESS_QUERY_INFORMATION = 0x0400
    PROCESS_VM_READ = 0x0010
    handle = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, False, pid)
    if not handle:
        return ""
    length = 260
    name = ctypes.create_unicode_buffer(length)
    ctypes.windll.psapi.GetModuleBaseNameW(handle, 0, name, length)
    ctypes.windll.kernel32.CloseHandle(handle)
    return name.value.lower()

def find_metaeditor_windows(target_process_name):
    hwnds = []
    user32 = ctypes.windll.user32
    target_process_name = target_process_name.lower()

    def callback(hwnd, lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        proc_name = get_window_process_name(hwnd)
        if target_process_name in proc_name:
            hwnds.append(hwnd)
            return True
        
        class_name = ctypes.create_unicode_buffer(260)
        user32.GetClassNameW(hwnd, class_name, 260)
        if "MetaEditor" in class_name.value:
            hwnds.append(hwnd)
            return True
            
        title = ctypes.create_unicode_buffer(260)
        user32.GetWindowTextW(hwnd, title, 260)
        if "MetaEditor" in title.value:
            hwnds.append(hwnd)
            return True
        return True

    user32.EnumWindows(EnumWindowsProc(callback), 0)
    return hwnds

def main():
    if len(sys.argv) < 8:
        print("Usage: BuraqCompiler.exe <MetaDir> <PathFile> <MiniME> <Timemini> <CloseME> <TimeClose> <ProcessName>")
        sys.exit(1)

    mini_me = sys.argv[3] == "1"
    time_mini = int(sys.argv[4])
    close_me = sys.argv[5] == "1"
    time_close = int(sys.argv[6])
    process_name = sys.argv[7]

    user32 = ctypes.windll.user32
    time.sleep(0.5)

    if mini_me:
        if time_mini > 0:
            time.sleep(time_mini / 1000.0)
        hwnds = find_metaeditor_windows(process_name)
        for hwnd in hwnds:
            user32.ShowWindow(hwnd, SW_MINIMIZE)

    if close_me:
        wait_time = time_close
        if mini_me:
            wait_time = max(0, time_close - time_mini)
        
        if wait_time > 0:
            time.sleep(wait_time / 1000.0)
            
        hwnds = find_metaeditor_windows(process_name)
        for hwnd in hwnds:
            user32.PostMessageW(hwnd, WM_CLOSE, 0, 0)

if __name__ == "__main__":
    main()
