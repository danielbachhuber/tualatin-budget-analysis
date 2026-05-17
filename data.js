// City of Tualatin budget data, FY 2019-20 through FY 2026-27 proposed.
// Source: City of Tualatin Budget in Brief documents (FY20-21 through FY25-26)
// and the FY 2026-27 Proposed Budget "Summary of All Funds" (page 57).
//
// All figures in USD.
//
// Schema note: Each Budget in Brief publishes a comparison table for two
// fiscal years. The "current year" column is treated as authoritative for
// that fiscal year. Where briefs differ on a prior year (because of mid-year
// amendments), this dataset uses the value originally published as that
// year's adopted budget.
//
// The Proposed FY26-27 budget reports revenue categories using a slightly
// different schema. To produce consistent trend lines, the proposed values
// have been normalized to match the brief schema:
//   - Licenses, Permits & Fees = Franchise Fees + Licenses And Permits
//   - Transfers and Other      = Miscellaneous + Other Financing Sources + Transfers In
//   - Contingencies & Reserves = Contingency + Reserves & Unappropriated

window.BUDGET_DATA = {
  fiscal_years: [
    {
      fy: "FY2020-21",
      short: "FY20-21",
      kind: "adopted",
      total_resources: 134022555,
      total_requirements: 134022565,
      revenues: {
        beginning_fund_balance: 71043465,
        property_taxes: 13479360,
        // FY20-21 brief reports Licenses & Permits ($888,030) and Franchise Fees
        // ($2,325,000) as separate lines. Combined to match later schema.
        licenses_permits_fees: 3213030,
        intergovernmental: 7612655,
        charges_for_service: 19500250,
        fines_forfeitures: 1158120,
        fees_charges: 4537270,
        transfers_and_other: 12375520,
        investment_earnings: 1102885,
      },
      expenditures: {
        // The FY20-21 brief labels this "Personnel Services" (later years use
        // "Personal Services" — same line, different spelling).
        personal_services: 21186265,
        materials_services: 21210055,
        transfers: 7587815,
        capital_outlay: 20254500,
        debt_service: 3908220,
        contingencies_reserves: 59875710,
      },
      adopted_pdf: "https://www.tualatinoregon.gov/sites/default/files/fileattachments/finance/page/56791/final_budget_condensed.pdf",
      brief_pdf:   "https://www.tualatinoregon.gov/sites/default/files/fileattachments/finance/page/56791/budget_in_brief.pdf",
    },
    {
      fy: "FY2021-22",
      short: "FY21-22",
      kind: "adopted",
      total_resources: 135205650,
      total_requirements: 135205650,
      revenues: {
        beginning_fund_balance: 69580500,
        property_taxes: 14018550,
        // L&P $849,530 + Franchise Fees $2,440,000 in FY21-22 brief.
        licenses_permits_fees: 3289530,
        intergovernmental: 10783725,
        charges_for_service: 21090280,
        fines_forfeitures: 1336500,
        fees_charges: 6199640,
        transfers_and_other: 8459080,
        investment_earnings: 447845,
      },
      expenditures: {
        personal_services: 22042160,
        materials_services: 25000865,
        transfers: 7646520,
        capital_outlay: 13356730,
        debt_service: 3975175,
        contingencies_reserves: 63184200,
      },
      adopted_pdf: "https://www.tualatinoregon.gov/sites/default/files/fileattachments/finance/page/56791/adopted_budget.pdf",
      brief_pdf:   "https://www.tualatinoregon.gov/sites/default/files/fileattachments/finance/page/56791/budget_in_brief_5.pdf",
    },
    {
      fy: "FY2022-23",
      short: "FY22-23",
      kind: "adopted",
      total_resources: 139439565,
      total_requirements: 139439565,
      revenues: {
        beginning_fund_balance: 69826615,
        property_taxes: 14665205,
        // L&P $859,925 + Franchise Fees $2,490,000 in FY22-23 brief.
        licenses_permits_fees: 3349925,
        intergovernmental: 12317830,
        charges_for_service: 22655375,
        fines_forfeitures: 1331000,
        fees_charges: 5542765,
        transfers_and_other: 9134710,
        investment_earnings: 616140,
      },
      expenditures: {
        personal_services: 23573345,
        materials_services: 24408965,
        transfers: 8749875,
        capital_outlay: 28010000,
        debt_service: 4074070,
        contingencies_reserves: 50623310,
      },
      adopted_pdf: "https://www.tualatinoregon.gov/sites/default/files/fileattachments/finance/page/56791/website_version_-_reduced_size.pdf",
      brief_pdf:   "https://www.tualatinoregon.gov/sites/default/files/fileattachments/finance/page/56791/budget_in_brief_3.pdf",
    },
    {
      fy: "FY2023-24",
      short: "FY23-24",
      kind: "adopted",
      total_resources: 153639340,
      total_requirements: 153639340,
      revenues: {
        beginning_fund_balance: 86655535,
        property_taxes: 16957110,
        licenses_permits_fees: 3883320,
        intergovernmental: 11234430,
        charges_for_service: 15409655,
        fines_forfeitures: 976000,
        fees_charges: 6516925,
        transfers_and_other: 9156405,
        investment_earnings: 2849960,
      },
      expenditures: {
        personal_services: 25069185,
        materials_services: 15987665,
        transfers: 8992560,
        capital_outlay: 35226885,
        debt_service: 5713305,
        contingencies_reserves: 62649740,
      },
      // Per FY26-27 proposed budget summary: Actuals FY23-24 totaled 162,431,136.
      actual_total: 162431136,
      adopted_pdf: "https://www.tualatinoregon.gov/sites/default/files/fileattachments/finance/page/56791/2024_budget_book_-_compiled_budget_book_-_smaller_size.pdf",
      brief_pdf:   "https://www.tualatinoregon.gov/sites/default/files/fileattachments/finance/page/56791/budget_in_brief_2.pdf",
    },
    {
      fy: "FY2024-25",
      short: "FY24-25",
      kind: "adopted",
      total_resources: 158698925,
      total_requirements: 158698925,
      revenues: {
        beginning_fund_balance: 89424990,
        property_taxes: 17276340,
        licenses_permits_fees: 4404605,
        intergovernmental: 9111010,
        charges_for_service: 17711625,
        fines_forfeitures: 1035700,
        fees_charges: 6895540,
        transfers_and_other: 9430425,
        investment_earnings: 3408690,
      },
      expenditures: {
        personal_services: 25979815,
        materials_services: 15805190,
        transfers: 9133835,
        capital_outlay: 28525585,
        debt_service: 5733305,
        contingencies_reserves: 73521195,
      },
      actual_total: 162806752,
      adopted_pdf: "https://www.tualatinoregon.gov/sites/default/files/fileattachments/finance/page/56791/final_adopted_budget_-_compressed.pdf",
      brief_pdf:   "https://www.tualatinoregon.gov/sites/default/files/fileattachments/finance/page/56791/budget_in_brief_1.pdf",
    },
    {
      fy: "FY2025-26",
      short: "FY25-26",
      kind: "adopted",
      total_resources: 165489430,
      total_requirements: 165489430,
      revenues: {
        beginning_fund_balance: 88999450,
        property_taxes: 18026125,
        licenses_permits_fees: 5082015,
        intergovernmental: 8959270,
        charges_for_service: 19031350,
        fines_forfeitures: 1132500,
        fees_charges: 7137610,
        transfers_and_other: 13711790,
        investment_earnings: 3409320,
      },
      expenditures: {
        personal_services: 27538550,
        materials_services: 18186720,
        transfers: 12861300,
        capital_outlay: 25880700,
        debt_service: 6008435,
        contingencies_reserves: 75013725,
      },
      adopted_pdf: "https://www.tualatinoregon.gov/sites/default/files/fileattachments/finance/page/56791/adopted_budget_2025-26-optimized.pdf",
      brief_pdf:   "https://www.tualatinoregon.gov/sites/default/files/fileattachments/finance/page/56791/final_budget-in-brief_2025.pdf",
    },
    {
      fy: "FY2026-27",
      short: "FY26-27",
      kind: "proposed",
      total_resources: 176951360,
      total_requirements: 176951360,
      revenues: {
        beginning_fund_balance: 92240630,
        property_taxes: 17621335,
        // Brief schema combines Franchise Fees + Licenses And Permits.
        // Proposed shows Franchise 3,544,535 + Licenses 1,830,410 = 5,374,945.
        licenses_permits_fees: 5374945,
        intergovernmental: 14385895,
        charges_for_service: 21475370,
        fines_forfeitures: 1130500,
        fees_charges: 7030440,
        // Misc 2,072,310 + Other Financing 50,000 + Transfers In 12,813,035.
        transfers_and_other: 14935345,
        investment_earnings: 2756900,
      },
      expenditures: {
        personal_services: 29405260,
        materials_services: 20489665,
        transfers: 12755705,
        capital_outlay: 35143750,
        debt_service: 4415605,
        // Contingency 24,707,370 + Reserves & Unappropriated 50,034,005.
        contingencies_reserves: 74741375,
      },
      proposed_pdf: "https://www.tualatinoregon.gov/sites/default/files/fileattachments/finance/page/6486/final_proposed_budget_fy2026-27-compressed.pdf",
      notice_pdf:   "https://www.tualatinoregon.gov/sites/default/files/fileattachments/finance/page/6486/notice_of_budget_fy27_website.pdf",
      fte: 167.35,
      fte_change: 3,
    },
  ],

  // Pulled from the FY26-27 Proposed budget message and Summary of All Funds.
  proposed_highlights: [
    {
      title: "+$11.3M total budget vs. FY25-26 adopted",
      body: "The proposed budget of $176.95M is 6.8% larger than FY25-26 adopted ($165.49M)."
    },
    {
      title: "Capital Outlay up nearly 35%",
      body: "Capital Outlay grows to $35.1M (34.4% of the budget), driven by sewer upsizing on Martinazzi Ave and SW 108th, plus continued work on the B-Level Reservoir."
    },
    {
      title: "Personal Services +6.78%",
      body: "Staffing rises to 167.35 FTE (+3 from FY25-26): a Recreation Supervisor, a Storm/Sewer Technician, and one new manager from splitting the Road/Storm/Sewer division."
    },
    {
      title: "Property tax revenue declining 2.25%",
      body: "Permanent tax rate revenue is stable, but the GO Bond Fund levy rate is dropping because the 2023 Parks Improvement Bond's remaining $10M sale is pushed to 2027."
    },
    {
      title: "Charges for Services up 12.84%",
      body: "Utility rate increases (Water, Sewer, Stormwater) plus a phase-in of market-rate recreation fees through Spring 2027."
    },
    {
      title: "Investment earnings down ~19%",
      body: "Declining interest rates are reducing portfolio yields, though the City's diversified strategy continues to outperform short-term rates."
    },
  ],

  inventory_url: "INVENTORY.md",
  city_finance_url: "https://www.tualatinoregon.gov/finance",
  archive_url: "https://www.tualatinoregon.gov/finance/adopted-budget-and-budget-brief",
};
