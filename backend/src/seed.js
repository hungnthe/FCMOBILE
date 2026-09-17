const { readCollection, replaceCollection } = require('./jsonStore');

const initialPlayers = [
  { name: "Kylian Mbappé", rating: 122, position: "lw, st", nation: "France", club: "Real Madrid", pac: 97, sho: 94, pas: 88, dri: 95, def: 42, phy: 82, cardType: "TOTY", photoUrl: "https://images.unsplash.com/photo-1543351611-c82399575a20?auto=format&fit=crop&w=400&q=80", matches: 15, goals: 12, assists: 7, motm: 4 },
  { name: "Son Heung-Min", rating: 91, position: "lw, cf", nation: "Korea", club: "Tottenham Hotspur", pac: 89, sho: 90, pas: 84, dri: 87, def: 44, phy: 76, cardType: "Gold", photoUrl: "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=400&q=80", matches: 12, goals: 8, assists: 5, motm: 3 },
  { name: "Gareth Bale", rating: 92, position: "rw, lw, st", nation: "Wales", club: "Real Madrid (Icon)", pac: 95, sho: 91, pas: 86, dri: 89, def: 68, phy: 84, cardType: "Icon", photoUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=400&q=80", matches: 8, goals: 5, assists: 3, motm: 2 },
  { name: "Marek Hamšík", rating: 89, position: "cm, cam", nation: "Slovakia", club: "Napoli (Hero)", pac: 78, sho: 85, pas: 90, dri: 86, def: 72, phy: 79, cardType: "Hero", photoUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=400&q=80", matches: 7, goals: 4, assists: 3, motm: 2 },
  { name: "Bastian Schweinsteiger", rating: 90, position: "cm, lm", nation: "Germany", club: "Bayern Munich (Icon)", pac: 76, sho: 84, pas: 89, dri: 85, def: 82, phy: 86, cardType: "Icon", photoUrl: "https://images.unsplash.com/photo-1560272564-6695205542a0?auto=format&fit=crop&w=400&q=80", matches: 6, goals: 3, assists: 2, motm: 1 },
  { name: "Declan Rice", rating: 88, position: "cdm, cm", nation: "England", club: "Arsenal", pac: 77, sho: 72, pas: 83, dri: 81, def: 88, phy: 87, cardType: "Gold", photoUrl: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=400&q=80", matches: 4, goals: 1, assists: 1, motm: 1 },
  { name: "Piero Hincapié", rating: 85, position: "cb, lb", nation: "Ecuador", club: "Bayer Leverkusen", pac: 83, sho: 52, pas: 72, dri: 75, def: 86, phy: 82, cardType: "Gold", photoUrl: "https://images.unsplash.com/photo-1628891890377-5732c52e46b9?auto=format&fit=crop&w=400&q=80", matches: 3, goals: 1, assists: 0, motm: 0 },
  { name: "Lionel Messi", rating: 94, position: "rw, cam", nation: "Argentina", club: "Inter Miami", pac: 85, sho: 92, pas: 91, dri: 95, def: 35, phy: 65, cardType: "TOTY", photoUrl: "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=400&q=80", matches: 6, goals: 0, assists: 0, motm: 0 },
  { name: "Cristiano Ronaldo", rating: 93, position: "st", nation: "Portugal", club: "Al Nassr", pac: 87, sho: 93, pas: 79, dri: 86, def: 34, phy: 84, cardType: "Icon", photoUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=400&q=80", matches: 0, goals: 0, assists: 0, motm: 0 },
  { name: "Erling Haaland", rating: 91, position: "st", nation: "Norway", club: "Manchester City", pac: 89, sho: 93, pas: 66, dri: 80, def: 45, phy: 88, cardType: "Futties", photoUrl: "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=400&q=80", matches: 0, goals: 0, assists: 0, motm: 0 },
  { name: "Kevin De Bruyne", rating: 91, position: "cm", nation: "Belgium", club: "Manchester City", pac: 72, sho: 88, pas: 94, dri: 87, def: 65, phy: 78, cardType: "Gold", photoUrl: "", matches: 0, goals: 0, assists: 0, motm: 0 },
  { name: "Jude Bellingham", rating: 90, position: "cam", nation: "England", club: "Real Madrid", pac: 82, sho: 86, pas: 85, dri: 88, def: 78, phy: 84, cardType: "TOTY", photoUrl: "", matches: 0, goals: 0, assists: 0, motm: 0 },
  { name: "Virgil van Dijk", rating: 89, position: "cb", nation: "Netherlands", club: "Liverpool", pac: 78, sho: 60, pas: 71, dri: 72, def: 91, phy: 89, cardType: "Gold", photoUrl: "", matches: 0, goals: 0, assists: 0, motm: 0 },
  { name: "Thibaut Courtois", rating: 90, position: "gk", nation: "Belgium", club: "Real Madrid", pac: 85, sho: 89, pas: 76, dri: 93, def: 46, phy: 90, cardType: "Hero", photoUrl: "", matches: 0, goals: 0, assists: 0, motm: 0 },
  { name: "Pedri", rating: 86, position: "cm", nation: "Spain", club: "FC Barcelona", pac: 79, sho: 68, pas: 85, dri: 88, def: 68, phy: 67, cardType: "Gold", photoUrl: "", matches: 0, goals: 0, assists: 0, motm: 0 },
  { name: "Rodri", rating: 89, position: "cdm", nation: "Spain", club: "Manchester City", pac: 58, sho: 73, pas: 80, dri: 79, def: 87, phy: 84, cardType: "Gold", photoUrl: "", matches: 0, goals: 0, assists: 0, motm: 0 },
  { name: "Luka Modrić", rating: 87, position: "cm", nation: "Croatia", club: "Real Madrid", pac: 72, sho: 76, pas: 89, dri: 88, def: 72, phy: 66, cardType: "Gold", photoUrl: "", matches: 0, goals: 0, assists: 0, motm: 0 },
  { name: "Antoine Griezmann", rating: 88, position: "cam", nation: "France", club: "Atlético Madrid", pac: 80, sho: 88, pas: 87, dri: 87, def: 58, phy: 72, cardType: "Gold", photoUrl: "", matches: 0, goals: 0, assists: 0, motm: 0 },
  { name: "Federico Valverde", rating: 88, position: "cm", nation: "Uruguay", club: "Real Madrid", pac: 88, sho: 82, pas: 84, dri: 84, def: 80, phy: 82, cardType: "Gold", photoUrl: "", matches: 0, goals: 0, assists: 0, motm: 0 },
  { name: "Achraf Hakimi", rating: 85, position: "rb", nation: "Morocco", club: "Paris Saint-Germain", pac: 92, sho: 75, pas: 79, dri: 80, def: 76, phy: 78, cardType: "Gold", photoUrl: "", matches: 0, goals: 0, assists: 0, motm: 0 }
];

// Matches are now owned by a Season and are created through the Match API.
const initialMatches = [];

async function seed() {
  const existingPlayers = readCollection('players.json');
  if (existingPlayers.length > 0) {
    console.log("players.json already contains data; seed skipped to protect your edits.");
    return;
  }

  const starterPlayers = initialPlayers.map((player, index) => ({
    player_id: index + 1,
    program: player.club ? [player.club] : [],
    ovr: player.rating,
    position: String(player.position || 'CM').split(',').map((item) => item.trim().toLowerCase()),
    nation: player.nation,
    Status_I_H_M: player.cardType,
    number: 0,
    name: player.name,
    stats: {
      goalAmounts: player.goals || 0,
      assistAmounts: player.assists || 0,
      match: player.matches || 0,
      bestPlayerAmount: player.motm || 0,
      sessionAmount: 0
    },
    active: { HTH: [], lastWeekCup: 0 },
    imageCard: player.photoUrl ? [player.photoUrl] : [],
    metadata: { note: '', createdAt: new Date().toISOString().slice(0, 10) }
  }));

  console.log("Seeding JSON files with Ajax Champions player cards & matches...");
  replaceCollection('players.json', starterPlayers, 'player_id');
  replaceCollection('matches.json', initialMatches);
  console.log("JSON seed completed successfully!");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
