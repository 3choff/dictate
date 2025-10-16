#[cfg(target_os = "windows")]
use windows::Win32::Foundation::HWND;
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

#[cfg(not(target_os = "windows"))]
pub fn set_window_no_activate(_hwnd: isize) -> Result<(), String> {
    Ok(())
}
