// server/utils/wordFilter.js
import pkg from 'mint-filter';
import fs from 'fs';
import path from 'path';

// 1. 改用 let，這樣後面才能重新賦值修正
let MintFilter = pkg.MintFilter || pkg;

// 2. 再次保險：處理某些打包工具導致的嵌套 default
if (typeof MintFilter !== 'function' && MintFilter.default) {
    MintFilter = MintFilter.default;
}

const __dirname = path.resolve();
const filePathCh = path.join(__dirname, 'server/util/zh.txt');
const filePathEn = path.join(__dirname, 'server/util/en.txt');

// 載入中文詞庫
let chineseWords = [];
try {
    const content = fs.readFileSync(filePathCh, 'utf-8');
    chineseWords = content.split('\n').map(w => w.trim()).filter(Boolean);
} catch (err) {
    console.error('❌ 讀取 zh.txt 失敗:', err.message);
    chineseWords = ['垃圾', '混蛋'];
}

// 載入英文詞庫
let englishWords = [];
try {
    const content = fs.readFileSync(filePathEn, 'utf-8');
    englishWords = content.split('\n').map(w => w.trim()).filter(Boolean);
} catch (err) {
    console.error('❌ 讀取 en.txt 失敗:', err.message);
    englishWords = ['fuck', 'shit'];
}

// 3. 初始化過濾器
const mintCh = new MintFilter(chineseWords);
const mintEn = new MintFilter(englishWords);

/**
 * 檢查內容
 */
export const checkContent = (text) => {
    if (!text) return { isBad: false, cleanText: '' };

    // mint-filter 的 verify 回傳 true 代表「字眼乾淨」
    const isChClean = mintCh.verify(text);
    const isEnClean = mintEn.verify(text);

    // 進行過濾（把髒話變星號）
    const chFiltered = mintCh.filter(text).text;
    const finalFiltered = mintEn.filter(chFiltered).text;

    return {
        // 只要中文或英文有其中一個「不乾淨 (!true)」，整句就是 isBad
        isBad: !isChClean || !isEnClean, 
        cleanText: finalFiltered
    };
};