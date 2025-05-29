import path from 'path'
import { fileURLToPath } from 'url'
import ejs from "ejs"
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const renderEmailEjs = async (fileName, payload) => {
    const filePath = path.resolve(__dirname, '../views', `${fileName}.ejs`);
    const html = await ejs.renderFile(filePath, payload);
    return html;
  };