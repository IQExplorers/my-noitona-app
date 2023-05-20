const cheerio = require("cheerio");
const axios = require("axios");


const CSGOSelector =
  "#mw-content-text > div > div.panel-box.wiki-bordercolor-light.toggle-area.toggle-area-1.matches-list > div:nth-child(2) > div:nth-child(1)";

const valorantSelector =
  "#mw-content-text > div > div.panel-box.wiki-bordercolor-light.toggle-area.toggle-area-1.matches-list > div:nth-child(2) > div:nth-child(1)";

const dotaSelector =
  "#mw-content-text > div > div.panel-box.wiki-bordercolor-light.toggle-area.toggle-area-1.matches-list > div:nth-child(2) > div:nth-child(1)";

//fake
const fakeDotaSelector = "#mw-content-text > div > div:nth-child(3) > div";

const CSGOSourse = "https://liquipedia.net/counterstrike/Liquipedia:Matches";

const dotaSource =
  "https://liquipedia.net/dota2/Liquipedia:Upcoming_and_ongoing_matches";
//fake
const fakeDotaSource = "https://liquipedia.net/dota2/B8";

const valorantSourse = "https://liquipedia.net/valorant/Liquipedia:Matches";

async function parseMatches(sourcePage, selector, game) {
  const { data: html } = await axios.get(sourcePage);

  let matches = [];
  const $ = cheerio.load(html);
  $(selector)
    .find("table")
    .each((tableId, tableElement) => {
      let enemy;
      let matchFound = false;

      const leftTeam = $(tableElement).find(".team-left").text().trim();
      const rightTeam = $(tableElement).find(".team-right").text().trim();

      if (leftTeam === "B8") {
        enemy = rightTeam;
        matchFound = true;
      } else if (rightTeam === "B8") {
        enemy = leftTeam;
        matchFound = true;
      }

      if (matchFound) {
        const tournamentName = $(tableElement)
          .find("tr:nth-child(2) > td > div > div > a")
          .text();

        const tournamentLink = $(tableElement)
          .find("tr:nth-child(2) > td > div > div > a")
          .attr("href");

        const dateText = $(tableElement)
          .find(".match-countdown")
          .text()
          .replace("-", "")
          .trim();

        const format = $(tableElement)
          .find("tr:nth-child(1)")
          .find("abbr")
          .text();

        const dateObj = new Date(Date.parse(dateText));

        const status = dateObj.getTime() < Date.now() ? "going" : "upcoming";

        matches.push({
          Name: enemy,
          Game: game,
          Date: dateObj,
          Format: format,
          Status: status,
          Tournament: {
            name: tournamentName,
            link: "https://liquipedia.net" + tournamentLink,
          },
        });
        matchFound = false;
        enemy = null;
      }
    });
  console.log(`${game}`, matches);
  return matches;
}

async function parseDota() {
  const { data: html } = await axios.get(fakeDotaSource);

  let matches = [];
  const $ = cheerio.load(html);
  $(fakeDotaSelector)
    .find("table")
    .each((tableId, tableElement) => {
      const leftTeam = $(tableElement).find(".team-left").text().trim();
      const rightTeam = $(tableElement).find(".team-right").text().trim();

      const dateText = $(tableElement)
        .find(".match-countdown")
        .text()
        .replace("-", "")
        .trim();

      const dateObj = new Date(Date.parse(dateText));

      const tournamentName = $(tableElement)
        .find("tr:nth-child(2) > td > div > div > a")
        .text();

      const tournamentLink = $(tableElement)
        .find("tr:nth-child(2) > td > div > div > a")
        .attr("href");

      const format = $(tableElement)
        .find("tr:nth-child(1)")
        .find("abbr")
        .text();

      const status = dateObj.getTime() < Date.now() ? "going" : "upcoming";

      const enemy = leftTeam === "B8" ? rightTeam : leftTeam;

      matches.push({
        Name: enemy,
        Game: "dota",
        Date: dateObj,
        Format: format,
        Status: status,
        Tournament: {
          name: tournamentName,
          link: "https://liquipedia.net" + tournamentLink,
        },
      });
    });
  console.log("dota", matches);
  return matches;
}

async function getMatches() {
  const valorantMatches = await parseMatches(
    valorantSourse,
    valorantSelector,
    "valorant"
  );
  const CSGOMathes = await parseMatches(CSGOSourse, CSGOSelector, "csgo");
  const dotaMatches = await parseDota();

  return [...CSGOMathes, ...valorantMatches, ...dotaMatches];
}

// parseMatches(valorantSourse, valorantSelector, "valorant");
// parseMatches(CSGOSourse, CSGOSelector, "csgo");
// parseMatches(dotaSource, dotaSelector, "dota");
// parseDota();

// const intervalId = setInterval(parseCS, 10000);

// setTimeout(() => {
//   clearInterval(intervalId);
// }, 30000);

module.exports = {
  getMatches: getMatches,
};
