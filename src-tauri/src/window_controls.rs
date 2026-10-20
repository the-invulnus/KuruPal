use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager, menu::{CheckMenuItem, Menu, MenuItem}, tray::TrayIconBuilder};

struct WindowControls {
    enabled: AtomicBool,
    item: CheckMenuItem<tauri::Wry>,
    visibility_item: MenuItem<tauri::Wry>,
}

// Called only on the main thread, serializing native menu and command toggles.
fn toggle(app: &tauri::AppHandle) -> Result<bool, String> {
    let state = app.state::<WindowControls>();
    let previous = state.enabled.load(Ordering::Relaxed);
    let enabled = !previous;
    let window = app.get_webview_window("main").ok_or("桌宠窗口不存在")?;
    if let Err(error) = window.set_ignore_cursor_events(enabled) {
        let _ = state.item.set_checked(previous);
        return Err(error.to_string());
    }
    state.enabled.store(enabled, Ordering::Relaxed);
    let _ = state.item.set_checked(enabled);
    let _ = state.item.set_text(if enabled { "点击穿透：已开启" } else { "点击穿透：已关闭" });
    let _ = app.emit("click-through-changed", enabled);
    Ok(enabled)
}

#[tauri::command]
pub fn click_through_enabled(app: tauri::AppHandle) -> bool {
    app.state::<WindowControls>().enabled.load(Ordering::Relaxed)
}

#[tauri::command]
pub async fn toggle_click_through(app: tauri::AppHandle) -> Result<bool, String> {
    let (send, receive) = tokio::sync::oneshot::channel();
    let handle = app.clone();
    app.run_on_main_thread(move || { let _ = send.send(toggle(&handle)); }).map_err(|e| e.to_string())?;
    receive.await.map_err(|e| e.to_string())?
}

// Visibility is deliberately not saved: a fresh launch always shows the pet.
// Both entry points run on the main thread, as do the native menu updates.
fn set_visible(app: &tauri::AppHandle, visible: bool) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("桌宠窗口不存在")?;
    if visible { window.show() } else { window.hide() }.map_err(|e| e.to_string())?;
    let state = app.state::<WindowControls>();
    let _ = state.visibility_item.set_text(if visible { "隐藏桌宠" } else { "显示桌宠" });
    Ok(())
}

fn toggle_visibility(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("桌宠窗口不存在")?;
    set_visible(app, !window.is_visible().map_err(|e| e.to_string())?)
}

#[tauri::command]
pub async fn hide_pet(app: tauri::AppHandle) -> Result<(), String> {
    let (send, receive) = tokio::sync::oneshot::channel();
    let handle = app.clone();
    app.run_on_main_thread(move || { let _ = send.send(set_visible(&handle, false)); }).map_err(|e| e.to_string())?;
    receive.await.map_err(|e| e.to_string())?
}

pub fn setup(app: &mut tauri::App) -> tauri::Result<()> {
    let item = CheckMenuItem::with_id(app, "tray-click-through", "点击穿透：已关闭", true, false, None::<&str>)?;
    let visibility_item = MenuItem::with_id(app, "tray-visibility", "隐藏桌宠", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "tray-quit", "退出 KuruPal", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&visibility_item, &item, &quit])?;
    app.manage(WindowControls { enabled: AtomicBool::new(false), item, visibility_item });
    // Provide recovery before the frontend can hide the window or ignore clicks.
    let mut tray = TrayIconBuilder::with_id("kurupal-controls")
        .tooltip("KuruPal")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray-click-through" => {
                if let Err(error) = toggle(app) { let _ = app.emit("click-through-error", error); }
            }
            "tray-visibility" => {
                if let Err(error) = toggle_visibility(app) { let _ = app.emit("window-control-error", error); }
            }
            "tray-quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() { tray = tray.icon(icon.clone()); }
    tray.build(app)?;
    Ok(())
}
