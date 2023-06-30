import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();
import { Client } from "@notionhq/client";

// Initializing a client
const notion = new Client({
	auth: process.env.NOTION_API_KEY,
});

export default notion;

