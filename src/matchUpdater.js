const { Client } = require("@notionhq/client");
const parser = require("./parser");
require("dotenv").config();
const express = require("express");

const notion = new Client({
  auth: process.env.INTEGRATION_TOKEN,
});

const databaseId = process.env.DATABASE_ID;

async function getDatabaseMatches() {
  const databasePages = [];

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 7);
  const filter = {
    property: "Date",
    date: {
      on_or_after: oneDayAgo.toISOString().split("T")[0], // Convert to ISO date format (YYYY-MM-DD)
    },
  };
  let cursor = undefined;
  while (true) {
    const { results, next_cursor } = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      filter: filter,
    });

    databasePages.push(...results);

    if (!next_cursor) {
      break;
    }
    cursor = next_cursor;
  }

  //console.log("databasePages", databasePages);

  return databasePages.map((page) => {
    return { ...page.properties, pageId: page.id };
  });
}

async function addMatches(matches) {
  await Promise.all(
    matches.map(async (match) => {
      let emoji;
      if (match.Game === "Dota 2") emoji = "🟥";
      else if (match.Game === "CS:GO") emoji = "🟪";
      else if (match.Game === "Valorant") emoji = "🟦";

      const matchDate = new Date(match.Date.getTime());
      const cetDateObj = new Date(
        matchDate.setUTCHours(matchDate.getUTCHours() + 2)
      );

      await notion.pages.create({
        icon: {
          type: "emoji",
          emoji: emoji,
        },
        parent: { database_id: databaseId },
        properties: {
          Name: {
            title: [
              {
                text: { content: match.Name ? match.Name : "NOT FOUND" },
              },
            ],
          },
          Status: {
            status: {
              name: match.Status ? match.Status : "NOT FOUND",
            },
          },
          Game: {
            select: { name: match.Game },
          },
          Format: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: match.Format ? match.Format : "NOT FOUND",
                },
              },
            ],
          },
          Date: {
            date: {
              start: cetDateObj,
              time_zone: "CET",
            },
          },
          Tournament: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: match.Tournament
                    ? match.Tournament.name
                    : "NOT FOUND",
                },
              },
            ],
          },
        },
        children: [
          {
            object: "block",
            type: "bookmark",
            bookmark: {
              url: match.Tournament ? match.Tournament.link : "NOT FOUND",
            },
          },
        ],
      });
    })
  );
}

function filterAddMatches(currentMatches, databasePages) {
  try {
    return currentMatches.filter((match) => {
      let fit = true;

      databasePages.forEach((page) => {
        const date1 = new Date(match.Date.getTime());
        const date2 = new Date(Date.parse(page.Date.date.start));
        console.log("page name", page.Name.title[0].text.content);
        console.log("date1", date2);
        console.log("match name", match.Name);
        console.log("date2", date1);
        if (
          match.Date.getTime() === Date.parse(page.Date.date.start) &&
          match.Tournament.name === page.Tournament.rich_text[0].text.content
        ) {
          fit = false;
        }
      });
      return fit;
    });
  } catch (ex) {
    console.log("ex", ex);
  }
}

//not used
function filterDeprecatedMatches(currentMatches, databasePages) {
  try {
    return databasePages.filter((page) => {
      let deprecated = true;

      currentMatches.forEach((match) => {
        if (match.Name === page.Name.title[0].text.content) {
          deprecated = false;
        }
      });

      return deprecated;
    });
  } catch (ex) {
    console.log("ex", ex);
  }
}

async function deletePages(databasePages) {
  try {
    await Promise.all(
      databasePages.map(async (page) => {
        if (Date.parse(page.Date.date.start) + 10_800_000 < Date.now()) {
          await notion.pages.update({
            page_id: page.pageId,
            properties: {
              Status: {
                status: { name: "Done" },
              },
            },
          });
        }
      })
    );
  } catch (exc) {
    console.log("exc", exc);
  }
}

async function updateDatabase(currentMatches, databasePages) {
  try {
    const updates = [];
    for (const match of currentMatches) {
      for (const page of databasePages) {
        const pageToUpdate = {};

        const matchDate = new Date(match.Date.getTime());
        const cetDateObj = new Date(
          matchDate.setUTCHours(matchDate.getUTCHours() + 2)
        );
        if (
          page.Name.title[0].text.content === "TBD" ||
          page.Status.status.name === "Done"
        ) {
          console.log("continue");
          continue;
        }

        if (
          match.Name === page.Name.title[0].text.content &&
          match.Status !== page.Status.status.name
        ) {
          pageToUpdate.Status = { status: { name: match.Status } };
        }

        if (
          match.Name === page.Name.title[0].text.content &&
          match.Date.getTime() !== Date.parse(page.Date.date.start)
        ) {
          pageToUpdate.Date = { date: { start: cetDateObj, time_zone: "CET" } };
        }

        if (Object.keys(pageToUpdate).length > 0) {
          updates.push(
            await notion.pages.update({
              page_id: page.pageId,
              properties: pageToUpdate,
            })
          );
        }
      }
    }
    await Promise.all(updates);
  } catch (ex) {
    console.log("ex", ex);
  }
}

async function fulfillTBD(currentMatches, databasePages) {
  try {
    const updates = [];
    for (const match of currentMatches) {
      for (const page of databasePages) {
        const pageToUpdate = {};

        if (match.Name === "TBD") continue;

        if (
          page.Name.title[0].text.content === "TBD" &&
          Date.parse(page.Date.date.start) === match.Date.getTime() &&
          page.Tournament.rich_text[0].text.content === match.Tournament.name
        ) {
          console.log("YESS");
          pageToUpdate.Name = { title: [{ text: { content: match.Name } }] };
        }

        if (Object.keys(pageToUpdate).length > 0) {
          updates.push(
            await notion.pages.update({
              page_id: page.pageId,
              properties: pageToUpdate,
            })
          );
        }
      }
    }
    await Promise.all(updates);
  } catch (ex) {
    console.log("ex", ex);
  }
}

async function run() {
  const currentMatches = await parser.getMatches();
  let databasePages = await getDatabaseMatches();
  console.log("dotaMatches[0]", currentMatches[1]);

  await updateDatabase(currentMatches, databasePages);
  databasePages = await getDatabaseMatches();

  await fulfillTBD(currentMatches, databasePages);
  await deletePages(databasePages);

  const filteredCurrentMatches = filterAddMatches(
    currentMatches,
    databasePages
  );
  await addMatches(filteredCurrentMatches);
}

run();
