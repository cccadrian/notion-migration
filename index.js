import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();
import axios from "axios";
import notion from "./notionClient.js";
import { iteratePaginatedAPI } from "@notionhq/client";
import { appendBlockChildren } from "@notionhq/client/build/src/api-endpoints.js";

async function createUser() {
	return userData;
}

// Fetches Notion databases from a dictionary
async function fetchNotionDatabases(databases) {
	const results = [];

	for (const [name, rootPageId] of Object.entries(databases)) {
		try {
			let pageNumber = 0;
			for await (const teamUser of iteratePaginatedAPI(
				notion.databases.query,
				{
					database_id: rootPageId,
					filter: {
						property: "directus",
						checkbox: {
							equals: false,
						},
					},
				},
			)) {
				// Do something with block.
				// console.log(teamUser, pageNumber);
				pageNumber = pageNumber + 1;
				// console.log(teamUser.id);
				// console.log(teamUser.properties);
				// console.log(teamUser.properties["Goes by"].rich_text[0]);
				// console.log(teamUser.properties["Birthday"].date);
				console.log(teamUser.properties["Name"].title[0].plain_text);
				// console.log(teamUser.properties["Pic"]);
				const userData = {
					first_name:
						teamUser.properties["Name"].title[0].plain_text.split(
							" ",
						)[0],
					last_name:
						teamUser.properties["Name"].title[0].plain_text.split(
							" ",
						)[1],
					email: teamUser.properties["CCC Email"].email,
					password: "cccareer$",
				};
				if (teamUser.properties["Personal Email"].email !== undefined) {
					// console.log(teamUser.properties["Personal Email"].email);
					userData.birthday =
						teamUser.properties["Personal Email"].email;
				}
				if (teamUser.properties["Birthday"].date !== undefined) {
					// console.log(teamUser.properties["Birthday"].date);
					userData.birthday = teamUser.properties["Birthday"].date;
				}
				if (
					teamUser.properties["Goes by"].rich_text[0] !== undefined &&
					teamUser.properties["Goes by"].rich_text[0].plain_text !==
						""
				) {
					// console.log(teamUser.properties["Goes by"].rich_text[0]);
					userData.goes_by =
						teamUser.properties["Goes by"].rich_text[0].plain_text;
				}
				if (teamUser.properties["Archive"].checkbox === true) {
					userData.status = "archived";
				}
				if (teamUser.properties["Resume URL"].rollup.array.length > 0) {
					const resumeData =
						teamUser.properties["Resume URL"].rollup.array[
							teamUser.properties["Resume URL"].rollup.array
								.length - 1
						].url;
					userData.resume_url = resumeData;
				}
				if (userData.email === "mail@email.com") {
					// console.log(userData);
					userData.email = `mail-${teamUser.id}@email.com`;
				}
				//find user in directus
				// console.log(userData);
				const userExists = await findDirectusUser(
					"users",
					userData.email,
				);
				let directusUser;
				console.log(userExists[0]);
				if (userExists[0] === undefined) {
					directusUser = await findDirectusUser("users", {
						email: {
							_eq: userData.email,
						},
					});
				} else {
					directusUser = userExists[0];
				}

				if (
					teamUser.properties["Apprentice"].relation !== undefined &&
					teamUser.properties["Apprentice"].relation.length > 0 &&
					teamUser.properties["Apprentice"].relation[0] !==
						undefined &&
					directusUser !== undefined &&
					directusUser.id !== undefined
				) {
					console.log("Its an apprentice");
					// console.log(teamUser.properties["Apprentice"]);
					const apprenticeId =
						teamUser.properties["Apprentice"].relation[0].id;
					const apprenticeData = await notion.pages.retrieve({
						page_id: apprenticeId,
					});
					// console.log(apprenticeData);
					// console.log(apprenticeData.properties.Status);
					// console.log(apprenticeData.properties["ETP Date"].date)

					const apprenticeJunctionExists =
						await findDirectusApprenticeJunction(
							"junction_directus_users_extended",
							directusUser.id,
						);
					// console.log(apprenticeJunctionExists);
					let directusApprentice;
					// console.log(userExists[0]);
					if (apprenticeJunctionExists[0] === undefined) {
						directusApprentice = await createDirectusRecord(
							"apprentices",
							{
								status: apprenticeData.properties.Status.status
									.name,
								ETP_hours:
									apprenticeData.properties["ETP Hours"]
										.number,
								ETP_date:
									apprenticeData.properties["ETP Date"]
										.date !== null
										? apprenticeData.properties["ETP Date"]
												.date.start
										: null,
							},
						);
						const directusJunctionUserApprentice =
							await createDirectusRecord(
								"junction_directus_users_extended",
								{
									directus_users_id: directusUser.id,
									collection: "apprentices",
									item: directusApprentice.id,
								},
							);
					} else {
						let directusApprenticeRequest =
							await findDirectusApprentice(
								"apprentices",
								apprenticeJunctionExists[0].item,
							);
						directusApprentice = directusApprenticeRequest[0];
					}
					// console.log("directusApprentice", directusApprentice);

					// console.log(
					// 	"directusJunctionUserApprentice",
					// 	directusJunctionUserApprentice,
					// );

					for await (const standUpReportPage of iteratePaginatedAPI(
						notion.databases.query,
						{
							database_id: "667dcd2445a947af944b40a7f5cb7a04",
							filter: {
								and: [
									{
										property: "Apprentice",
										relation: {
											contains: apprenticeData.id,
										},
									},
									{
										property: "directus",
										checkbox: {
											equals: false,
										},
									},
								],
							},
						},
					)) {
						// console.log(standUpReportPage);ls
						let standUpReportContent = "";
						for await (const block of iteratePaginatedAPI(
							notion.blocks.children.list,
							{
								block_id: standUpReportPage.id,
							},
						)) {
							// Do something with block.
							// console.log("block", block);
							if (block.type === "heading_2") {
								if (
									block.heading_2.rich_text[0] !== undefined
								) {
									standUpReportContent =
										standUpReportContent.concat(
											`<h2>${block.heading_2.rich_text[0].plain_text}</h2>`,
										);
								}
							} else if (block.type === "paragraph") {
								if (
									block.paragraph.rich_text[0] !== undefined
								) {
									standUpReportContent =
										standUpReportContent.concat(
											`<p>${block.paragraph.rich_text[0].plain_text}</p>`,
										);
								}
							}
						}
						// console.log("standupreportcontent ", standUpReportContent);
						// console.log(apprenticeData.id)
						const standUpReport = await createDirectusRecord(
							"stand_up_reports",
							{
								apprentice: directusApprentice.id,
								blocked:
									standUpReportPage.properties["Blocked"]
										.checkbox,
								content: standUpReportContent,
								creation_date: standUpReportPage.created_time,
							},
						);
						//Let the registry knows
						const standUpReportResponse = await notion.pages.update(
							{
								page_id: standUpReportPage.id,
								properties: {
									directus: {
										checkbox: true,
									},
								},
							},
						);
						// console.log(
						// 	`standUpReportResponse`,
						// 	standUpReportResponse,
						// );

						//we create the SUR
					}
					const apprenticeUpdateResponse = await notion.pages.update({
						page_id: apprenticeData.id,
						properties: {
							directus: {
								checkbox: true,
							},
						},
					});
					// console.log(
					// 	`apprenticeUpdateResponse`,
					// 	apprenticeUpdateResponse,
					// );
				}
				//console.log(directusUser);
				//Let the registry knows
				const userUpdateResponse = await notion.pages.update({
					page_id: teamUser.id,
					properties: {
						directus: {
							checkbox: true,
						},
					},
				});
				// console.log(`userUpdateResponse`, userUpdateResponse);
			}
			for await (const coreCurriculum of iteratePaginatedAPI(
				notion.databases.query,
				{
					database_id: "8f10b16d6157428294b4d5fb1f900e00",
					filter: {
						property: "Parent",
						relation: {
							is_empty: true,
						},
					},
				},
			)) {
				console.log(
					"core curriculum",
					coreCurriculum.properties["Children"].relation,
				);
				//First level
				const directusCoreCurriculumProgram =
					await createDirectusRecord("core_curriculum", {
						notion_id: coreCurriculum.id,
						name:
							coreCurriculum.properties["Name"].title !== null
								? coreCurriculum.properties["Name"].title[0]
										.plain_text
								: null,
						report_types:
							coreCurriculum.properties["Report Types"]
								.multi_select !== null
								? coreCurriculum.properties["Report Types"]
										.multi_select[0].name
								: null,
						type:
							coreCurriculum.properties["Type"].select !== null
								? coreCurriculum.properties["Type"].select.name
								: null,
						delivery_format:
							coreCurriculum.properties["Delivery Format"]
								.select !== null
								? coreCurriculum.properties["Delivery Format"]
										.select.name
								: null,
					});
				for await (const coreCurriculumChildren of iteratePaginatedAPI(
					notion.databases.query,
					{
						database_id: "8f10b16d6157428294b4d5fb1f900e00",
						filter: {
							property: "Parent",
							relation: {
								contains: coreCurriculum.id,
							},
						},
					},
				)) {
					console.log(
						`Core Curriculum -${
							coreCurriculumChildren.properties["Name"].title !==
							null
								? coreCurriculumChildren.properties["Name"]
										.title[0].plain_text
								: null
						}`,
						// coreCurriculumChildren,
					);
					//Second level
					const directusCoreCurriculumProgramStage =
						await createDirectusRecord("core_curriculum", {
							notion_id: coreCurriculumChildren.id,
							name:
								coreCurriculumChildren.properties["Name"]
									.title !== null
									? coreCurriculumChildren.properties["Name"]
											.title[0].plain_text
									: null,
							report_types:
								coreCurriculumChildren.properties[
									"Report Types"
								].multi_select !== null
									? coreCurriculumChildren.properties[
											"Report Types"
									  ].multi_select[0].name
									: null,
							type:
								coreCurriculumChildren.properties["Type"]
									.select !== null
									? coreCurriculumChildren.properties["Type"]
											.select.name
									: null,
							delivery_format:
								coreCurriculumChildren.properties[
									"Delivery Format"
								].select !== null
									? coreCurriculumChildren.properties[
											"Delivery Format"
									  ].select.name
									: null,
							parent: directusCoreCurriculumProgram.id,
						});
					if (
						coreCurriculumChildren.properties["Children"]
							.relation !== undefined &&
						coreCurriculumChildren.properties["Children"].relation
							.length > 0
					) {
						console.log(
							"Has more children",
							coreCurriculumChildren.properties["Children"]
								.relation,
						);
						for await (const coreCurriculumChildrenNested of iteratePaginatedAPI(
							notion.databases.query,
							{
								database_id: "8f10b16d6157428294b4d5fb1f900e00",
								filter: {
									property: "Parent",
									relation: {
										contains: coreCurriculumChildren.id,
									},
								},
							},
						)) {
							console.log(
								"Core Curriculum Children Children ",
								coreCurriculumChildrenNested,
							);
							//Third level
							const directusCoreCurriculumProgramStageResource =
								await createDirectusRecord("core_curriculum", {
									notion_id: coreCurriculumChildrenNested.id,
									name:
										coreCurriculumChildrenNested.properties[
											"Name"
										].title !== null
											? coreCurriculumChildrenNested
													.properties["Name"].title[0]
													.plain_text
											: null,
									report_types:
										coreCurriculumChildrenNested.properties[
											"Report Types"
										].multi_select !== null
											? coreCurriculumChildrenNested
													.properties["Report Types"]
													.multi_select[0].name
											: null,
									type:
										coreCurriculumChildrenNested.properties[
											"Type"
										].select !== null
											? coreCurriculumChildrenNested
													.properties["Type"].select
													.name
											: null,
									delivery_format:
										coreCurriculumChildrenNested.properties[
											"Delivery Format"
										].select !== null
											? coreCurriculumChildrenNested
													.properties[
													"Delivery Format"
											  ].select.name
											: null,
									parent: directusCoreCurriculumProgramStage.id,
								});
							if (
								coreCurriculumChildrenNested.properties[
									"Children"
								].relation !== undefined &&
								coreCurriculumChildrenNested.properties[
									"Children"
								].relation.length > 0
							) {
								console.log("Has more children children");

								// for await (const coreCurriculumChildrenNestedNested of iteratePaginatedAPI(
								// 	notion.databases.query,
								// 	{
								// 		database_id:
								// 			"8f10b16d6157428294b4d5fb1f900e00",
								// 		filter: {
								// 			property: "Parent",
								// 			relation: {
								// 				contains:
								// 					coreCurriculumChildrenNested.id,
								// 			},
								// 		},
								// 	},
								// )) {
								// 	console.log(
								// 		"Core Curriculum Children Children Children ",
								// 		directusCoreCurriculumChildrenNested,
								// 	);
								// 	//Fourth Level
								// 	const directusCoreCurriculumChildrenNestedNested =
								// 		await createDirectusRecord(
								// 			"core_curriculum",
								// 			{
								// 				notion_id:
								// 					directusCoreCurriculumChildrenNested
								// 						.properties["ID"],
								// 				name: directusCoreCurriculumChildrenNested
								// 					.properties["Name"].title[0]
								// 					.plain_text,
								// 				report_types:
								// 					directusCoreCurriculumChildrenNested
								// 						.properties["Name"]
								// 						.title[0].plain_text,
								// 				parent: directusCoreCurriculumChildren.id,
								// 				type: directusCoreCurriculumChildrenNested
								// 					.properties["Name"].title[0]
								// 					.plain_text,
								// 				delivery_format:
								// 					directusCoreCurriculumChildrenNested
								// 						.properties["Name"]
								// 						.title[0].plain_text,
								// 			},
								// 		);
								// 	if (
								// 		coreCurriculumChildrenNestedNested
								// 			.properties["Children"].relation !==
								// 			undefined &&
								// 		coreCurriculumChildrenNestedNested
								// 			.properties["Children"].relation
								// 			.length > 0
								// 	) {
								// 		console.log(
								// 			"Has more children children children",
								// 		);
								// 	}
								// }
							}
						}
					}
				}
			}
		} catch (error) {
			console.error(
				`Failed to fetch data from Notion database ${name}:`,
				error.message,
			);
			break;
		}
	}

	return results;
}

// Creates a record on a Directus instance
async function createDirectusRecord(collection, data) {
	const directusAPIUrl = process.env.DIRECTUS_API_URL;
	const directusAPIKey = process.env.DIRECTUS_API_KEY;

	let url = `${directusAPIUrl}/items/${collection}`;
	if (collection === "users") {
		url = `${directusAPIUrl}/${collection}`;
	}

	const headers = {
		Authorization: `Bearer ${directusAPIKey}`,
		"Content-Type": "application/json",
	};
	try {
		const response = await axios.post(url, data, { headers });
		console.log(`Record created successfully in collection ${collection}`);
		return response.data.data;
	} catch (error) {
		console.error(
			`Failed to create record in collection ${collection}:`,
			error.message,
		);
	}
}

async function findDirectusApprenticeJunction(collection, userId) {
	const directusAPIUrl = process.env.DIRECTUS_API_URL;
	const directusAPIKey = process.env.DIRECTUS_API_KEY;

	let url = `${directusAPIUrl}/items/${collection}`;
	if (collection === "users") {
		url = `${directusAPIUrl}/${collection}`;
	}
	const headers = {
		Authorization: `Bearer ${directusAPIKey}`,
		"Content-Type": "application/json",
	};
	try {
		const apiUrl = `${url}?filter[directus_users_id][_eq]=${userId}`;
		// const apiUrl = `${url}?${filterQuery}`;
		const response = await axios.get(apiUrl, { headers });
		// console.log(response);
		return response.data.data;
	} catch (error) {
		console.error(
			`Failed to create record in collection ${collection}:`,
			error.message,
		);
	}
}

async function findDirectusApprentice(collection, apprenticeId) {
	const directusAPIUrl = process.env.DIRECTUS_API_URL;
	const directusAPIKey = process.env.DIRECTUS_API_KEY;

	let url = `${directusAPIUrl}/items/${collection}`;
	if (collection === "users") {
		url = `${directusAPIUrl}/${collection}`;
	}
	const headers = {
		Authorization: `Bearer ${directusAPIKey}`,
		"Content-Type": "application/json",
	};
	try {
		const apiUrl = `${url}?filter[id][_eq]=${apprenticeId}`;
		// const apiUrl = `${url}?${filterQuery}`;
		const response = await axios.get(apiUrl, { headers });
		// console.log(response);
		return response.data.data;
	} catch (error) {
		console.error(
			`Failed to create record in collection ${collection}:`,
			error.message,
		);
	}
}

async function findDirectusUser(collection, email) {
	const directusAPIUrl = process.env.DIRECTUS_API_URL;
	const directusAPIKey = process.env.DIRECTUS_API_KEY;

	let url = `${directusAPIUrl}/items/${collection}`;
	if (collection === "users") {
		url = `${directusAPIUrl}/${collection}`;
	}
	const headers = {
		Authorization: `Bearer ${directusAPIKey}`,
		"Content-Type": "application/json",
	};
	try {
		const apiUrl = `${url}?filter[email][_eq]=${email}`;
		// const apiUrl = `${url}?${filterQuery}`;
		const response = await axios.get(apiUrl, { headers });
		// console.log(response);
		return response.data.data;
	} catch (error) {
		console.error(
			`Failed to create record in collection ${collection}:`,
			error.message,
		);
	}
}

// Usage example
async function main() {
	const notionDatabases = {
		Team: "4206c55e30a943df9726ec1284b609af",
		// "Database 2": "DATABASE_2_ROOT_PAGE_ID",
		// Add more databases here
	};

	const notionRecords = await fetchNotionDatabases(notionDatabases);
	console.log("Fetched Notion databases:", notionRecords);
	// const directusCollection = "your_directus_collection_name";
	// const recordData = {
	// Data for creating a Directus record
	// Adjust this object according to your Directus collection schema
	// };

	// await createDirectusRecord(directusCollection, recordData);
}

main().catch((error) => console.error("An error occurred:", error));
