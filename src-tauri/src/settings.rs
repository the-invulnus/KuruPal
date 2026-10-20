use std::{fs, path::{Path, PathBuf}};
use serde_json::{Value, json};

struct Lock(PathBuf);
impl Drop for Lock { fn drop(&mut self) { let _ = fs::remove_dir(&self.0); } }
fn validate(value: &Value) -> Result<(), String> {
    if !matches!(value["size"].as_str(), Some("small" | "medium" | "large")) { return Err("无效的桌宠大小".into()); }
    if !value["opacity"].as_u64().is_some_and(|opacity| (25..=100).contains(&opacity)) {
        return Err("不透明度须为25～100之间的整数".into());
    }
    let stocks = value["watchlist"].as_array().ok_or("无效的关注列表")?;
    if stocks.len() > 5 || stocks.iter().any(|s| !s.as_str().is_some_and(|s| s.len() == 6 && s.bytes().all(|c| c.is_ascii_digit()))) {
        return Err("请输入六位A股代码，最多关注5只股票".into());
    }
    Ok(())
}
fn defaults(mut value: Value) -> Value {
    // Older apps and the existing settings skill may omit this new field.
    if let Some(fields) = value.as_object_mut() {
        fields.entry("opacity").or_insert(json!(100));
    }
    value
}
// A shared directory lock coordinates app and Python writers; readers see atomic snapshots.
pub fn access(base: &Path, initial: Option<Value>, patch: Option<Value>) -> Result<Value, String> {
    fs::create_dir_all(base).map_err(|e| e.to_string())?;
    let path = base.join("settings.json");
    if initial.is_none() && patch.is_none() {
        let value = defaults(serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?);
        validate(&value)?;
        return Ok(value);
    }
    let lock = base.join("settings.lock");
    fs::create_dir(&lock).map_err(|_| "设置正在修改，请稍后重试")?;
    let _guard = Lock(lock);
    let mut value = defaults(if path.exists() {
        serde_json::from_slice(&fs::read(&path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?
    } else { initial.ok_or("请先启动新版桌宠完成设置迁移")? });
    validate(&value)?;
    if let Some(patch) = patch {
        let fields = patch.as_object().ok_or("无效的设置")?;
        for (key, val) in fields {
            if key != "size" && key != "watchlist" && key != "opacity" { return Err("未知设置".into()); }
            value[key] = val.clone();
        }
    }
    validate(&value)?;
    let mut stocks = Vec::new();
    for s in value["watchlist"].as_array().unwrap() { if !stocks.contains(s) { stocks.push(s.clone()); } }
    value["watchlist"] = json!(stocks);
    value["schemaVersion"] = json!(1);
    let temp = base.join(".settings-app.tmp");
    fs::write(&temp, value.to_string()).map_err(|e| e.to_string())?;
    fs::rename(temp, path).map_err(|e| e.to_string())?;
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn migration_patch_validation_and_lock() {
        let base = std::env::temp_dir().join(format!("market-pet-settings-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        let original = json!({"size":"large","watchlist":["000001"]});
        let migrated = access(&base, Some(original.clone()), None).unwrap();
        assert_eq!(migrated["opacity"], 100);
        let updated = access(&base, None, Some(json!({"size":"small"}))).unwrap();
        assert_eq!(updated["watchlist"], original["watchlist"]);
        assert_eq!(access(&base, Some(original), None).unwrap()["size"], "small");
        assert!(access(&base, None, Some(json!({"watchlist":["bad"]}))).is_err());
        assert_eq!(access(&base, None, None).unwrap(), updated);
        let translucent = access(&base, None, Some(json!({"opacity":25}))).unwrap();
        assert_eq!(translucent["size"], "small");
        assert_eq!(translucent["watchlist"], updated["watchlist"]);
        assert_eq!(access(&base, None, None).unwrap()["opacity"], 25);
        for invalid in [json!(0), json!(24), json!(101), json!(50.5), json!("50"), json!(true), Value::Null] {
            assert!(access(&base, None, Some(json!({"opacity":invalid}))).is_err());
            assert_eq!(access(&base, None, None).unwrap(), translucent);
        }
        fs::create_dir(base.join("settings.lock")).unwrap();
        assert!(access(&base, None, Some(json!({"size":"large"}))).is_err());
        fs::remove_dir_all(base).unwrap();
    }
}
