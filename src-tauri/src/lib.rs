use std::fs;
use std::path::{Path, PathBuf};

use encoding_rs::{Encoding, WINDOWS_1252};
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NcFile {
    name: String,
    path: String,
    size: u64,
    encoding: &'static str,
    content: String,
}

/// Decodes file bytes to text.
///
/// A byte-order mark wins; otherwise the bytes are taken as UTF-8, and if they
/// aren't valid UTF-8 we fall back to Windows-1252, which is what older
/// controllers and CAM post-processors commonly emit.
fn decode(bytes: Vec<u8>) -> (String, &'static str) {
    if let Some((encoding, bom_len)) = Encoding::for_bom(&bytes) {
        let (text, _) = encoding.decode_without_bom_handling(&bytes[bom_len..]);
        return (text.into_owned(), encoding.name());
    }

    match String::from_utf8(bytes) {
        Ok(text) => (text, "UTF-8"),
        Err(err) => {
            let (text, _) = WINDOWS_1252.decode_without_bom_handling(err.as_bytes());
            (text.into_owned(), WINDOWS_1252.name())
        }
    }
}

fn read_nc_file(path: &Path) -> Result<NcFile, String> {
    let bytes = fs::read(path).map_err(|e| format!("Failed to read {}: {e}", path.display()))?;
    let size = bytes.len() as u64;
    let (content, encoding) = decode(bytes);

    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Unknown".to_string());

    Ok(NcFile {
        name,
        path: path.display().to_string(),
        size,
        encoding,
        content,
    })
}

/// Reads an NC file chosen by the user. Runs on a blocking thread so large
/// files don't stall the async runtime.
#[tauri::command]
async fn open_nc_file(path: PathBuf) -> Result<NcFile, String> {
    tauri::async_runtime::spawn_blocking(move || read_nc_file(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![open_nc_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_utf8() {
        let (text, encoding) = decode("G1 X1 (Ø 6mm)".as_bytes().to_vec());
        assert_eq!(text, "G1 X1 (Ø 6mm)");
        assert_eq!(encoding, "UTF-8");
    }

    #[test]
    fn strips_utf8_bom() {
        let (text, encoding) = decode(b"\xEF\xBB\xBFG1 X1".to_vec());
        assert_eq!(text, "G1 X1");
        assert_eq!(encoding, "UTF-8");
    }

    #[test]
    fn decodes_utf16le_with_bom() {
        let mut bytes = vec![0xFF, 0xFE];
        bytes.extend("M30".encode_utf16().flat_map(u16::to_le_bytes));
        let (text, encoding) = decode(bytes);
        assert_eq!(text, "M30");
        assert_eq!(encoding, "UTF-16LE");
    }

    #[test]
    fn falls_back_to_windows_1252() {
        // "(Fräser Ø6)" in Windows-1252: ä = 0xE4, Ø = 0xD8
        let (text, encoding) = decode(b"(Fr\xE4ser \xD86)".to_vec());
        assert_eq!(text, "(Fräser Ø6)");
        assert_eq!(encoding, "windows-1252");
    }

    #[test]
    fn reads_file_metadata() {
        let path = std::env::temp_dir().join("ncview-test.nc");
        fs::write(&path, b"G0 X0\nM30\n").unwrap();
        let file = read_nc_file(&path).unwrap();
        fs::remove_file(&path).unwrap();

        assert_eq!(file.name, "ncview-test.nc");
        assert_eq!(file.size, 10);
        assert_eq!(file.content, "G0 X0\nM30\n");
    }

    #[test]
    fn reports_missing_file() {
        let err = read_nc_file(Path::new("/definitely/not/here.nc")).unwrap_err();
        assert!(err.starts_with("Failed to read /definitely/not/here.nc"));
    }
}
