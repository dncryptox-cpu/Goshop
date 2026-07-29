import React, { useState } from 'react';
import type { UserSession } from '../types';
import { Key, Eye, EyeOff, ShieldCheck, Trash2, X, ExternalLink, DollarSign, Sparkles, LogOut, Copy, Check, Cloud, Code } from 'lucide-react';
import { saveApiKey } from '../utils/storage';
import { getStoredAppsScriptUrl, saveAppsScriptUrl } from '../utils/cloudSync';

interface SettingsModalProps {
  apiKey: string;
  onSaveKey: (key: string) => void;
  stakeAmount: number;
  onUpdateStake: (amount: number) => void;
  session: UserSession | null;
  onLogout: () => void;
  onSeedDemoData: () => void;
  onResetAllData: () => void;
  onClose: () => void;
}

const GOOGLE_APPS_SCRIPT_CODE = `
// Mã Google Apps Script gắn với Google Sheet (ID: 1gZ5sevZrKGzcL7ap0IBdyO3NdymkovwjDOQfC9xQf4o)
function doGet(e) {
  return respondJSON({
    status: "online",
    message: "EN Terminal Apps Script Backend is running.",
    spreadsheetId: "1gZ5sevZrKGzcL7ap0IBdyO3NdymkovwjDOQfC9xQf4o"
  });
}

function doPost(e) {
  try {
    var contents = JSON.parse(e.postData.contents);
    var action = contents.action;
    var username = contents.username;
    var password = contents.password;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var userSheet = ss.getSheetByName("Users");
    if (!userSheet) {
      userSheet = ss.insertSheet("Users");
      userSheet.appendRow(["username", "password", "data", "updatedAt"]);
    }

    if (action === "register") {
      var data = userSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === username) {
          return respondJSON({ status: "error", message: "Tên đăng nhập đã tồn tại trên hệ thống!" });
        }
      }
      var defaultData = JSON.stringify({
        progress: { lastCompletedDate: null, lastCheckDate: getTodayDateString(), streak: 0, stakeAmount: 50000, totalBurned: 0, totalPreserved: 0 },
        journal: [],
        speaking: [],
        srs: []
      });
      userSheet.appendRow([username, password, defaultData, new Date().toISOString()]);
      return respondJSON({ status: "success", message: "Đăng ký tài khoản thành công!", data: JSON.parse(defaultData) });
    }

    if (action === "login") {
      var data = userSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === username) {
          if (data[i][1] === password) {
            var userData = data[i][2] ? JSON.parse(data[i][2]) : {};
            return respondJSON({ status: "success", message: "Đăng nhập thành công!", data: userData });
          } else {
            return respondJSON({ status: "error", message: "Mật khẩu không chính xác!" });
          }
        }
      }
      return respondJSON({ status: "error", message: "Tài khoản không tồn tại!" });
    }

    if (action === "getData") {
      var data = userSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === username && data[i][1] === password) {
          var userData = data[i][2] ? JSON.parse(data[i][2]) : {};
          return respondJSON({ status: "success", data: userData });
        }
      }
      return respondJSON({ status: "error", message: "Phiên đăng nhập không hợp lệ hoặc sai mật khẩu!" });
    }

    if (action === "saveData") {
      var data = userSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === username && data[i][1] === password) {
          userSheet.getRange(i + 1, 3).setValue(JSON.stringify(contents.data));
          userSheet.getRange(i + 1, 4).setValue(new Date().toISOString());
          return respondJSON({ status: "success", message: "Đã lưu dữ liệu lên Google Sheet!" });
        }
      }
      return respondJSON({ status: "error", message: "Không tìm thấy tài khoản để lưu dữ liệu." });
    }

    return respondJSON({ status: "error", message: "Hành động không hợp lệ." });
  } catch (err) {
    return respondJSON({ status: "error", message: "Lỗi Google Apps Script: " + err.toString() });
  }
}

function respondJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getTodayDateString() {
  var d = new Date();
  var month = "" + (d.getMonth() + 1);
  var day = "" + d.getDate();
  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;
  return [d.getFullYear(), month, day].join("-");
}
`.trim();

export const SettingsModal: React.FC<SettingsModalProps> = ({
  apiKey,
  onSaveKey,
  stakeAmount,
  onUpdateStake,
  session,
  onLogout,
  onSeedDemoData,
  onResetAllData,
  onClose,
}) => {
  const [inputKey, setInputKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [inputStake, setInputStake] = useState(stakeAmount.toString());
  const [scriptUrl, setScriptUrl] = useState(getStoredAppsScriptUrl());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showGasCode, setShowGasCode] = useState(false);
  const [copiedGas, setCopiedGas] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveKey(inputKey.trim());
    saveApiKey(inputKey.trim());
    saveAppsScriptUrl(scriptUrl.trim());

    const stakeVal = parseInt(inputStake, 10);
    if (!isNaN(stakeVal) && stakeVal >= 0) {
      onUpdateStake(stakeVal);
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleCopyGasCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedGas(true);
    setTimeout(() => setCopiedGas(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-6 font-sans max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 font-mono">
          <div className="flex items-center space-x-2 text-amber-400 font-bold">
            <Key className="w-5 h-5" />
            <span>TERMINAL SETTINGS // CONFIG</span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Session Info */}
        {session && (
          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex items-center justify-between font-mono text-xs">
            <div className="space-y-0.5">
              <span className="text-zinc-500 text-[10px]">TÀI KHOẢN ĐANG ĐĂNG NHẬP:</span>
              <p className="font-bold text-amber-400 text-sm">{session.username}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="flex items-center space-x-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 px-3 py-1.5 rounded-lg font-bold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>ĐĂNG XUẤT</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          
          {/* Gemini API Key section */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold text-zinc-200 flex items-center justify-between">
              <span>GOOGLE GEMINI API KEY:</span>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline text-[11px] flex items-center font-normal"
              >
                Lấy API Key Miễn Phí (Google AI Studio)
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </label>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 pr-10 pl-3 py-2.5 rounded-lg font-mono text-sm focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Apps Script URL */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <label className="text-xs font-mono font-bold text-zinc-200 flex items-center">
              <Cloud className="w-4 h-4 mr-1 text-cyan-400" />
              GOOGLE APPS SCRIPT WEB APP URL (/exec):
            </label>
            <input
              type="url"
              value={scriptUrl}
              onChange={(e) => setScriptUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-3 py-2.5 rounded-lg font-mono text-xs focus:outline-none focus:border-amber-500"
            />
            <div className="flex items-center justify-between text-[11px]">
              <a
                href="https://docs.google.com/spreadsheets/d/1gZ5sevZrKGzcL7ap0IBdyO3NdymkovwjDOQfC9xQf4o/edit#gid=537818933"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline inline-flex items-center"
              >
                Mở Google Sheet (ID: 1gZ5sevZrKGzc...) <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>

              <button
                type="button"
                onClick={() => setShowGasCode(!showGasCode)}
                className="text-amber-400 hover:underline font-mono inline-flex items-center"
              >
                <Code className="w-3 h-3 mr-1" />
                {showGasCode ? 'Ẩn mã Apps Script' : 'Xem mã Apps Script Code.gs'}
              </button>
            </div>

            {/* Apps Script Code Modal/Box */}
            {showGasCode && (
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-2 font-mono text-[11px] animate-fadeIn">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
                  <span className="text-amber-400 font-bold">Mã Google Apps Script Code.gs:</span>
                  <button
                    type="button"
                    onClick={handleCopyGasCode}
                    className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 font-bold"
                  >
                    {copiedGas ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedGas ? 'Đã copy!' : 'Copy Mã'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  value={GOOGLE_APPS_SCRIPT_CODE}
                  rows={8}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 p-2 rounded text-[10px] focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Daily Stake Amount */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <label className="text-xs font-mono font-bold text-zinc-200 flex items-center">
              <DollarSign className="w-4 h-4 mr-1 text-emerald-400" />
              DAILY STAKE (VND/NGÀY):
            </label>
            <input
              type="number"
              value={inputStake}
              onChange={(e) => setInputStake(e.target.value)}
              placeholder="50000"
              step={10000}
              min={0}
              className="w-full bg-zinc-950 border border-zinc-800 text-amber-400 font-mono font-bold px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          {savedSuccess && (
            <div className="p-2.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded font-mono text-xs text-center flex items-center justify-center space-x-1.5 animate-fadeIn">
              <ShieldCheck className="w-4 h-4" />
              <span>ĐÃ LƯU CẤU HÌNH THÀNH CÔNG!</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono font-bold px-6 py-2.5 rounded-lg text-xs transition-colors shadow-lg"
            >
              LƯU CẤU HÌNH (SAVE)
            </button>
          </div>
        </form>

        {/* Developer / Demo Data Actions */}
        <div className="pt-4 border-t border-zinc-800 space-y-3 font-mono text-xs">
          <span className="text-zinc-500 font-bold uppercase tracking-wider block text-[10px]">
            QUẢN LÝ DỮ LIỆU CÁ NHÂN:
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                onSeedDemoData();
                onClose();
              }}
              className="flex items-center justify-center space-x-2 bg-zinc-950 hover:bg-zinc-800 text-cyan-400 border border-zinc-800 p-2.5 rounded-lg transition-colors"
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>NẠP DỮ LIỆU DEMO</span>
            </button>

            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center justify-center space-x-2 bg-rose-950/40 hover:bg-rose-950 text-rose-400 border border-rose-900 p-2.5 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>RESET DỮ LIỆU</span>
            </button>
          </div>
        </div>

        {/* Reset Confirmation Sub-Modal */}
        {showResetConfirm && (
          <div className="p-4 bg-rose-950/90 border border-rose-800 rounded-xl space-y-3 font-mono text-xs text-rose-200 animate-fadeIn">
            <p className="font-bold text-rose-300">
              ⚠️ XÁC NHẬN RESET TOÀN BỘ DỮ LIỆU?
            </p>
            <p className="font-sans text-[11px] text-rose-300">
              Thao tác này sẽ xóa toàn bộ nhật ký, phiên luyện nói, streak và thẻ SRS Flashcards trên trình duyệt này.
            </p>
            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1 bg-zinc-900 text-zinc-300 rounded hover:bg-zinc-800"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetAllData();
                  setShowResetConfirm(false);
                  onClose();
                }}
                className="px-3 py-1 bg-rose-600 text-white rounded font-bold hover:bg-rose-500"
              >
                Xác nhận Reset
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
