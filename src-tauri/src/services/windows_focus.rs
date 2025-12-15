#[cfg(target_os = "windows")]
use windows::Win32::Foundation::HWND;
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::POINT;
#[cfg(target_os = "windows")]
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_NOACTIVATE,
};

#[cfg(target_os = "windows")]
pub fn set_window_no_activate(hwnd: isize) -> Result<(), String> {
    unsafe {
        let hwnd = HWND(hwnd as *mut core::ffi::c_void);
        
        // Get current extended window style
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        
        // Add WS_EX_NOACTIVATE flag to prevent window from being activated
        let new_style = ex_style | (WS_EX_NOACTIVATE.0 as isize);
        
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_style);
        
        println!("[WINDOWS] Set WS_EX_NOACTIVATE on window handle: {:p}", hwnd.0);
    }
    
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn get_work_area_for_point(x: i32, y: i32) -> Option<(i32, i32, i32, i32)> {
    unsafe {
        let hmonitor = MonitorFromPoint(POINT { x, y }, MONITOR_DEFAULTTONEAREST);
        if hmonitor.0.is_null() {
            return None;
        }

        let mut info: MONITORINFO = std::mem::zeroed();
        info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;

        if !GetMonitorInfoW(hmonitor, &mut info as *mut _ as *mut _).as_bool() {
            return None;
        }

        let r = info.rcWork;
        Some((r.left, r.top, r.right, r.bottom))
    }
}

#[cfg(not(target_os = "windows"))]
pub fn get_work_area_for_point(_x: i32, _y: i32) -> Option<(i32, i32, i32, i32)> {
    None
}

#[cfg(not(target_os = "windows"))]
pub fn set_window_no_activate(_hwnd: isize) -> Result<(), String> {
    Ok(())
}
