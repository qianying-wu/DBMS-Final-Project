// server/utils/wordFilter.js
import { MintFilter } from 'mint-filter';
import Filter from 'bad-words';
import fs from 'fs';
import path from 'path';

const __dirname = path.resolve();
const filePath = path.join(__dirname, 'server/utils/zh.txt');

let chineseWords = [];
try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    chineseWords = content.split('\n')
        .map(word => word.trim())
        .filter(word => word.length > 0);
        
    console.log(`成功載入 ${chineseWords.length} 個中文髒話關鍵字`);
} catch (err) {
    console.error('讀取 zh.txt 失敗，請檢查路徑:', err);
    // 萬一讀取失敗，給個保險的預設值
    chineseWords = ['垃圾', '混蛋']; 
}

const mint = new MintFilter(chineseWords);
const filter = new Filter();

export const checkContent = (text) => {
    if (!text) return { isBad: false, cleanText: '' };

    // A. 檢查中文敏感詞 (mint-filter)
    // verify 會回傳是否通過，filter 會回傳過濾後的字串
    const mintResult = mint.verify(text);
    
    // B. 檢查英文/混合髒話 (bad-words)
    const isProfane = filter.isProfane(text);

    return {
        isBad: !mintResult || isProfane,
        cleanText: filter.clean(mint.filter(text).text) // 雙重過濾後的結果
    };
};