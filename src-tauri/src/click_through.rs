use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager, menu::{CheckMenuItem, Menu, MenuItem}, tray::TrayIconBuilder};

struct ClickThrough {
    enabled: AtomicBool,
    item: CheckMenuItem<tauri::Wry>,
}

// Called only on the main thread, serializing native menu and command toggles.
fn toggle(app: &tauri::AppHandle) -> Result<bool, String> {
    let state = app.state::<ClickThrough>();
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
    app.state::<ClickThrough>().enabled.load(Ordering::Relaxed)
}

#[tauri::command]
pub async fn toggle_click_through(app: tauri::AppHandle) -> Result<bool, String> {
    let (send, receive) = tokio::sync::oneshot::channel();
    let handle = app.clone();
    app.run_on_main_thread(move || { let _ = send.send(toggle(&handle)); }).map_err(|e| e.to_string())?;
    receive.await.map_err(|e| e.to_string())?
}

pub fn setup(app: &mut tauri::App) -> tauri::Result<()> {
    let item = CheckMenuItem::with_id(app, "tray-click-through", "点击穿透：已关闭", true, false, None::<&str>)?;
    let quit = MenuItem::with_id(app, "tray-quit", "退出 KuruPal", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&item, &quit])?;
    app.manage(ClickThrough { enabled: AtomicBool::new(false), item });
    // Always provide a recovery menu before the frontend can enable passthrough.
    let mut tray = TrayIconBuilder::with_id("kurupal-controls")
        .tooltip("KuruPal · 右键切换点击穿透")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray-click-through" => {
                if let Err(error) = toggle(app) { let _ = app.emit("click-through-error", error); }
            }
            "tray-quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() { tray = tray.icon(icon.clone()); }
    tray.build(app)?;
    Ok(())
}
