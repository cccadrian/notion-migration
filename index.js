import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();
import axios from "axios";
import notion from "./notionClient.js";
import { iteratePaginatedAPI } from "@notionhq/client";

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
				// console.log(
				// 	teamUser.properties["Name"].title[0].plain_text.match(
				// 		/^(\S+)\s+(.+)$/,
				// 	),
				// );
				// teamUser.properties["Name"].title[0].plain_text.match(
				// 	/^(\S+)\s+(.+)$/,
				// );
				const separatedName =
					teamUser.properties["Name"].title[0].plain_text.match(
						/^(\S+)\s+(.+)$/,
					);
				const userData = {
					first_name: separatedName[1],
					last_name: separatedName[2],
					email: teamUser.properties["CCC Email"].email,
					password: "cccareer$",
				};

				// if (teamUser.properties["Personal Email"].email !== undefined) {
				// 	// console.log(teamUser.properties["Personal Email"].email);
				// 	userData.birthday =
				// 		teamUser.properties["Personal Email"].email;
				// }
				if (
					teamUser.properties["Birthday"].date !== undefined &&
					teamUser.properties["Birthday"].date !== null
				) {
					// console.log(teamUser.properties["Birthday"].date);
					userData.birthday =
						teamUser.properties["Birthday"].date.start;
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
				const userExists = await findDirectusUser(
					"users",
					userData.email,
				);

				let directusUser;

				if (userExists[0] === undefined) {
					// const missingUsers = [
					// 	"yahshemi@cccareers.org",
					// 	"alex@cccareers.org",
					// 	"tenille@cccareers.org",
					// 	"navroz@cccareers.org",
					// ];
					// if (
					// 	missingUsers.includes(
					// 		teamUser.properties["CCC Email"].email,
					// 	)
					// ) {
					// 	console.log(
					// 		"Found it.",
					// 		teamUser.properties["CCC Email"].email,
					// 	);
					// 	console.log("Problematic user data:", userData);
					// }
					userData.notion_id = teamUser.id;
					directusUser = await createDirectusRecord(
						"users",
						userData,
					);

					// console.log(directusUser);
					const notionDemographics = await notion.databases.query({
						database_id: "d6b4c1c6576d45c5bf877b23ea34dc47",
						filter: {
							property: "Team",
							relation: {
								contains: teamUser.id,
							},
						},
					});
					// console.log("notion demographics ", notionDemographics);
					if (
						notionDemographics.results !== undefined &&
						notionDemographics.results.length > 0
					) {
						const demographicsData = notionDemographics.results[0];
						const directusDemographics = await createDirectusRecord(
							"demographics",
							{
								state: demographicsData.properties["State"]
									.select.name,
								zip_code:
									demographicsData.properties["Zip Code"]
										.rich_text.length > 0
										? demographicsData.properties[
												"Zip Code"
										  ].rich_text[0].plain_text
										: "",
								user: directusUser.id,
							},
						);
						// console.log({
						// 	state: demographicsData.properties["State"].select
						// 		.name,
						// 	zip_code:
						// 		demographicsData.properties["Zip Code"]
						// 			.rich_text.length > 0
						// 			? demographicsData.properties["Zip Code"]
						// 					.rich_text[0].plain_text
						// 			: "",
						// 	directus_users_id: teamUser.id,
						// });
					}
				} else {
					console.log(
						`User Exists ${userExists[0].id} ... attempting update`,
					);
					userData.notion_id = teamUser.id;
					delete userData.password;
					directusUser = await updateDirectusRecord(
						userExists[0].id,
						userData,
					);
					console.log("Updated successfully");
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
					// console.log(teamUser.properties["Apprentice"]);
					const apprenticeId =
						teamUser.properties["Apprentice"].relation[0].id;
					console.log("Its an apprentice:", apprenticeId);
					const apprenticeData = await notion.pages.retrieve({
						page_id: apprenticeId,
					});
					// console.log(apprenticeData);
					// console.log(apprenticeData.properties.Status);
					// console.log(apprenticeData.properties["ETP Date"].date)
					// console.log(
					// 	"Apprentice status",
					// 	apprenticeData.properties.Status.status.name,
					// );
					// console.log("directus user id", directusUser.id);

					const apprenticeExists = await findDirectusApprentice(
						"apprentices",
						directusUser.id,
					);
					// console.log(apprenticeExists);
					let directusApprentice;
					// console.log(userExists[0]);
					if (apprenticeExists[0] === undefined) {
						directusApprentice = await createDirectusRecord(
							"apprentices",
							{
								status: `${apprenticeData.properties.Status.status.name}`,
								ETP_hours:
									apprenticeData.properties["ETP Hours"]
										.number,
								ETP_date:
									apprenticeData.properties["ETP Date"]
										.date !== null
										? apprenticeData.properties["ETP Date"]
												.date.start
										: null,
								directus_users_id: directusUser.id,
								notion_id: apprenticeId,
							},
						);
						// const directusJunctionUserApprentice =
						// 	await createDirectusRecord(
						// 		"junction_directus_users_extended",
						// 		{
						// 			directus_users_id: directusUser.id,
						// 			collection: "apprentices",
						// 			item: directusApprentice.id,
						// 		},
						// 	);
					} else {
						// let directusApprenticeRequest =
						// 	await findDirectusApprentice(
						// 		"apprentices",
						// 		apprenticeJunctionExists[0].item,
						// 	);
						directusApprentice = apprenticeExists[0];
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
						// console.log(new Date(standUpReportPage.created_time));
						const standUpReport = await createDirectusRecord(
							"stand_up_reports",
							{
								apprentice: directusApprentice.id,
								blocked:
									standUpReportPage.properties["Blocked"]
										.checkbox,
								content: standUpReportContent,
								date_created: standUpReportPage.created_time,
								// creation_date: standUpReportPage.created_time,
								// created_on: standUpReportPage.created_time,
								status: `${
									standUpReportPage.properties.Status
										.select !== null
										? standUpReportPage.properties.Status
												.select.name
										: "Open"
								}`,

								notion_id: standUpReportPage.id,
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
				//Search if the user has a skillbridge record

				const notionSkillbridgeData = await notion.databases.query({
					database_id: "730a536c78ef47098e82aa14c27862f6",
					filter: {
						property: "Team",
						relation: {
							contains: teamUser.id,
						},
						filter: {
							property: "directus",
							checkbox: {
								equals: false,
							},
						},
					},
				});
				if (
					notionSkillbridgeData.results !== undefined &&
					notionSkillbridgeData.results.length > 0
				) {
					console.log("Has a skillbridge record.");
					let skillbridgeData = {
						notion_id: notionSkillbridgeData.results[0].id,
						became_apprentice:
							notionSkillbridgeData.results[0].properties[
								"Became Apprentice"
							].checkbox !== null
								? notionSkillbridgeData.results[0].properties[
										"Became Apprentice"
								  ].checkbox
								: null,
						user: directusUser.id,
					};
					if (
						notionSkillbridgeData.results[0].properties[
							"Finish Program Date"
						].date !== null
					) {
						skillbridgeData.finish_program_date =
							notionSkillbridgeData.results[0].properties[
								"Finish Program Date"
							].date.start;
					}

					const directusSkillbridge = await createDirectusRecord(
						"skillbridge",
						skillbridgeData,
					);

					const skillbridgeUpdateResponse = await notion.pages.update(
						{
							page_id: notionSkillbridgeData.results[0].id,
							properties: {
								directus: {
									checkbox: true,
								},
							},
						},
					);
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
				// console.log(
				// 	"core curriculum",
				// 	coreCurriculum.properties["Children"].relation,
				// );
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
					// console.log(
					// 	`Core Curriculum -${
					// 		coreCurriculumChildren.properties["Name"].title !==
					// 		null
					// 			? coreCurriculumChildren.properties["Name"]
					// 					.title[0].plain_text
					// 			: null
					// 	}`,
					// 	// coreCurriculumChildren,
					// );
					//Second level
					// console.log(
					// 	coreCurriculumChildren.properties["Delivery Format"]
					// 		.select !== null
					// 		? coreCurriculumChildren.properties[
					// 				"Delivery Format"
					// 		  ].select.name
					// 		: null,
					// );
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
						// console.log(
						// 	"Has more children",
						// 	coreCurriculumChildren.properties["Children"]
						// 		.relation,
						// );
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
							// console.log(
							// 	"Core Curriculum Children Children ",
							// 	coreCurriculumChildrenNested,
							// );
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
								// console.log("Has more children children");
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
		console.log({
			Payload: data,
			url,
			headers,
		});
	}
}

async function updateDirectusRecord(userId, data) {
	const directusAPIUrl = process.env.DIRECTUS_API_URL;
	const directusAPIKey = process.env.DIRECTUS_API_KEY;

	let url = `${directusAPIUrl}/users/${userId}`;
	// console.log(userId, data, url);
	const headers = {
		Authorization: `Bearer ${directusAPIKey}`,
		"Content-Type": "application/json",
	};
	try {
		const response = await axios.patch(url, data, { headers });
		// console.log(response);
		console.log(`User ${userId} UPDATED successfully`);
		return response.data.data;
	} catch (error) {
		console.error(`Failed to update user ${userId}:`, error.message);
		console.log({
			Payload: data,
			url,
			headers,
		});
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

async function findDirectusApprentice(collection, directusUserId) {
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
		const apiUrl = `${url}?filter[user][_eq]=${directusUserId}`;
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

// function lowercaseWithUnderscores(string) {
// 	// Convert the string to lowercase
// 	var lowercaseString = string.toLowerCase();

// 	// Replace spaces with underscores
// 	// var underscoredString = lowercaseString.replace(/ /g, "_");

// 	return underscoredString;
// }

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
