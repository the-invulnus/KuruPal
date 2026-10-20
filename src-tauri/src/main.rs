#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod settings;
mod click_through;
use tauri::Manager;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
struct FetchState(Mutex<Option<Instant>>);
async fn collect_quotes(symbols: Vec<String>, state: tauri::State<'_, FetchState>) -> Result<serde_json::Value, String> {
    if symbols.is_empty() || symbols.len() > 5 || symbols.iter().any(|s| s.len()!=6 || !s.bytes().all(|c| c.is_ascii_digit())) {
        return Err("请输入1～5个六位A股代码".into());
    }
    let mut last = state.0.try_lock().map_err(|_| "行情正在刷新")?;
    if last.is_some_and(|t| t.elapsed() < Duration::from_secs(55)) { return Err("请等待下一分钟刷新".into()); }
    *last = Some(Instant::now());
    let mut path = std::env::current_exe().map_err(|e|e.to_string())?;
    path.set_file_name(if cfg!(windows) { "market-data.exe" } else { "market-data" });
    let mut command = tokio::process::Command::new(path);
    command.args(&symbols).kill_on_drop(true);
    #[cfg(windows)] command.creation_flags(0x08000000);
    let output = tokio::time::timeout(Duration::from_secs(55), command.output()).await
        .map_err(|_| "行情请求超时")?.map_err(|e| e.to_string())?;
    if !output.status.success() { return Err("行情采集器启动失败".into()); }
    serde_json::from_slice(&output.stdout).map_err(|_| "行情返回格式异常".into())
}


// Bounded JSONL diagnostics; never write collector stderr or proxy credentials.
fn append_market_log(app: &tauri::AppHandle, value: serde_json::Value) {
    let write = || -> Result<(), Box<dyn std::error::Error>> {
        use std::io::Write;
        let directory = app.path().app_data_dir()?.join("logs");
        std::fs::create_dir_all(&directory)?;
        let path = directory.join("market.jsonl");
        if std::fs::metadata(&path).map(|m|m.len()>2_000_000).unwrap_or(false) {
            let old = directory.join("market.previous.jsonl");
            let _ = std::fs::remove_file(&old);
            std::fs::rename(&path, old)?;
        }
        let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)?.as_millis();
        let line = serde_json::json!({"timestampMs":timestamp,"data":value}).to_string();
        let mut file = std::fs::OpenOptions::new().create(true).append(true).open(path)?;
        writeln!(file,"{}",line)?;
        Ok(())
    };
    let _ = write();
}
#[tauri::command]
fn market_log(app: tauri::AppHandle, value: serde_json::Value) {
    if value.to_string().len() <= 8192 { append_market_log(&app,value); }
}
#[tauri::command]
async fn quotes(app: tauri::AppHandle, symbols: Vec<String>, state: tauri::State<'_, FetchState>) -> Result<serde_json::Value,String> {
    let started=Instant::now();
    append_market_log(&app,serde_json::json!({"event":"fetch_start","symbols":symbols}));
    let result=collect_quotes(symbols,state).await;
    match &result {
        Ok(value)=>append_market_log(&app,serde_json::json!({"event":"fetch_result","elapsedMs":started.elapsed().as_millis(),"result":value})),
        Err(error)=>append_market_log(&app,serde_json::json!({"event":"fetch_error","elapsedMs":started.elapsed().as_millis(),"error":error})),
    }
    result
}

// Files are atomically renamed into this inbox by the external agent hook.
#[tauri::command]
fn drain_hooks(app: tauri::AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?.join("hooks");
    std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let mut paths: Vec<_> = std::fs::read_dir(&directory).map_err(|e| e.to_string())?
        .filter_map(Result::ok).map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "json")).collect();
    // Filenames include a random suffix, so lexical order is not arrival order.
    paths.sort_by_cached_key(|path| {
        (std::fs::symlink_metadata(path).and_then(|m| m.modified()).unwrap_or(std::time::UNIX_EPOCH), path.clone())
    });
    let mut events = Vec::new();
    for path in paths.into_iter().take(32) {
        let meta = std::fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
        if meta.is_file() && meta.len() <= 4096 {
            if let Ok(bytes) = std::fs::read(&path) {
                if let Ok(value) = serde_json::from_slice::<serde_json::Value>(&bytes) { events.push(value); }
            }
        }
        // Ignore malformed payloads without blocking later events.
        if !meta.is_dir() { std::fs::remove_file(path).map_err(|e| e.to_string())?; }
    }
    Ok(events)
}
#[tauri::command]
fn pet_settings(app: tauri::AppHandle, initial: Option<serde_json::Value>, patch: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    settings::access(&app.path().app_data_dir().map_err(|e| e.to_string())?, initial, patch)
}
fn main() {
    tauri::Builder::default().manage(FetchState(Mutex::new(None)))
        .setup(|app| { click_through::setup(app)?; Ok(()) })
        .invoke_handler(tauri::generate_handler![drain_hooks, quotes, market_log, pet_settings, click_through::toggle_click_through, click_through::click_through_enabled])
        .run(tauri::generate_context!()).expect("无法启动桌宠");
}
