const { Client } = require("@notionhq/client");
const parser = require("./parser");
require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();

const notion = new Client({
  auth: process.env.INTEGRATION_TOKEN,
});

const databaseId = process.env.DATABASE_ID;

async function getDatabaseMatches() {
  const { results } = await notion.databases.query({ database_id: databaseId });

  return results.map((page) => {
    return { ...page.properties, pageId: page.id };
  });
}

async function addMatches(matches) {
  await Promise.all(
    matches.map(async (match) => {
      await notion.pages.create({
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
              start: match.Date,
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
  return currentMatches.filter((match) => {
    let fit = true;

    databasePages.forEach((page) => {
      if (match.Name === page.Name.title[0].text.content) {
        fit = false;
      }
    });
    return fit;
  });
}

function filterDeprecatedMatches(currentMatches, databasePages) {
  return databasePages.filter((page) => {
    let deprecated = true;

    currentMatches.forEach((match) => {
      if (match.Name === page.Name.title[0].text.content) {
        deprecated = false;
      }
    });

    return deprecated;
  });
}

async function deletePages(deprecatedPages) {
  await Promise.all(
    deprecatedPages.map(async (page) => {
      await notion.pages.update({
        page_id: page.pageId,
        properties: {
          Status: {
            status: { name: "Done" },
          },
        },
      });
    })
  );
}

async function updateDatabase(filteredCurrentMatches, databasePages) {
  try {
    const updates = [];
    for (const match of filteredCurrentMatches) {
      for (const page of databasePages) {
        const pageToUpdate = {};
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
          pageToUpdate.Date = { date: { start: match.Date } };
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
  const databasePages = await getDatabaseMatches();
  const filteredCurrentMatches = filterAddMatches(
    currentMatches,
    databasePages
  );
  const deprecatedPages = filterDeprecatedMatches(
    currentMatches,
    databasePages
  );

  updateDatabase(currentMatches, databasePages);
  deletePages(deprecatedPages);
  addMatches(filteredCurrentMatches);
}

run();

const intervalId = setInterval(run, 60000);

async function runRquest() {
  const url = "http://localhost:3002/get"; 
  const { data } = await axios.get(url);
  console.log(data);
}

const intervalReqId = setInterval(runRquest, 10000);



function startServer() {
  app.get("/get", (req, resp) => {
    resp.send("server done!");
  });

  const port = 3001;
  app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
  });
}

startServer();
// setTimeout(() => {
//   clearInterval(intervalId);
// }, 500000);
