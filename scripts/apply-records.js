const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

// ================== CONFIG ==================
const TOKEN = process.env.DESEC_TOKEN;
const DOMAIN = "is-dev.me";
const BASE = `https://desec.io/api/v1/domains/${DOMAIN}/rrsets`;

// All supported DNS record types by deSEC
const SUPPORTED = [
  "A","AAAA","AFSDB","CAA","CNAME","DNAME","DS","HINFO",
  "HTTPS","LOC","MX","NAPTR","NS","PTR","RP","SPF","SRV",
  "SSHFP","SVCB","TLSA","TXT"
];

async function apply() {
  console.log("=== Starting DNS Apply Process ===");

  const files = fs.readdirSync("./records")
    .filter(f => f.endsWith(".json"));

  if (files.length === 0) {
    console.log("No record files found in /records");
    return;
  }

  for (const file of files) {
    console.log(`Processing file: ${file}`);

    const data = JSON.parse(
      fs.readFileSync(path.join("./records", file), "utf8")
    );

    const username = data.owner.username;
    const subname = username; // subdomain = username.is-dev.me
    const recordsObj = data.records;

    for (const type in recordsObj) {
      const value = recordsObj[type];
      const upperType = type.toUpperCase();

      if (!SUPPORTED.includes(upperType)) {
        throw new Error(`Record type "${upperType}" is not supported.`);
      }

      let recordValue = value;

      // Add trailing dot if needed
      if (
        ["CNAME", "NS", "PTR", "DNAME"].includes(upperType) &&
        !recordValue.endsWith(".")
      ) {
        recordValue += ".";
      }

      const payload = {
        subname,
        type: upperType,
        records: [recordValue],
        ttl: 3600
      };

      const url = `${BASE}/${subname}/${upperType}/`;

      console.log(`Applying ${upperType} record for ${subname}.${DOMAIN}`);

      // Try PUT first
      let r = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Token ${TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      // If PUT fails, try POST
      if (!r.ok) {
        console.log(`PUT failed (${r.status}), trying POST...`);

        r = await fetch(BASE + "/", {
          method: "POST",
          headers: {
            Authorization: `Token ${TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify([payload])
        });
      }

      if (!r.ok) {
        const errorText = await r.text();
        throw new Error(
          `Failed to apply record: ${upperType} for ${subname}.${DOMAIN}\n${errorText}`
        );
      }

      console.log(
        `✔ Successfully applied ${upperType} record for ${subname}.${DOMAIN}`
      );
    }
  }

  console.log("=== DNS Apply Completed ===");
}

apply().catch(err => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
