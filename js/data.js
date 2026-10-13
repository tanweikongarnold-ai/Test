// Scenario: October 1962. Positions are historical bases and garrisons;
// missile counts are scaled down for play.

// US strategic launchers. range in km, flight = sim seconds for a 9000 km shot,
// rel = launch reliability, reload = sim seconds, cost = $B per reload.
export const US_SITES = [
  { id: 'vandenberg', name: 'Vandenberg AFB', sub: 'Atlas D ICBM · California', lat: 34.73, lon: -120.57, kind: 'icbm', missiles: 4, range: 10000, flight: 14, rel: 0.72, reload: 40, cost: 3, hard: 0.1 },
  { id: 'warren', name: 'F.E. Warren AFB', sub: 'Atlas E ICBM · Wyoming', lat: 41.13, lon: -104.87, kind: 'icbm', missiles: 6, range: 10500, flight: 14, rel: 0.75, reload: 40, cost: 3, hard: 0.2 },
  { id: 'lowry', name: 'Lowry AFB', sub: 'Titan I ICBM · Colorado', lat: 39.72, lon: -104.88, kind: 'icbm', missiles: 6, range: 10000, flight: 13, rel: 0.78, reload: 45, cost: 3, hard: 0.5 },
  { id: 'mtnhome', name: 'Mountain Home AFB', sub: 'Titan I ICBM · Idaho', lat: 43.05, lon: -115.87, kind: 'icbm', missiles: 4, range: 10000, flight: 13, rel: 0.78, reload: 45, cost: 3, hard: 0.5 },
  { id: 'malmstrom', name: 'Malmstrom AFB', sub: 'Minuteman I ICBM · Montana', lat: 47.51, lon: -111.19, kind: 'icbm', missiles: 4, range: 10100, flight: 12, rel: 0.85, reload: 25, cost: 2, hard: 0.7 },
  { id: 'plattsburgh', name: 'Plattsburgh AFB', sub: 'Atlas F ICBM · New York', lat: 44.65, lon: -73.47, kind: 'icbm', missiles: 4, range: 10500, flight: 14, rel: 0.75, reload: 40, cost: 3, hard: 0.6 },
  { id: 'feltwell', name: 'RAF Feltwell', sub: 'Thor IRBM · England', lat: 52.48, lon: 0.52, kind: 'irbm', missiles: 6, range: 2800, flight: 10, rel: 0.8, reload: 30, cost: 2, hard: 0 },
  { id: 'gioia', name: 'Gioia del Colle', sub: 'Jupiter IRBM · Italy', lat: 40.77, lon: 16.93, kind: 'irbm', missiles: 4, range: 2800, flight: 10, rel: 0.8, reload: 30, cost: 2, hard: 0 },
  { id: 'izmir', name: 'Çiğli AB, Izmir', sub: 'Jupiter IRBM · Turkey', lat: 38.51, lon: 27.01, kind: 'irbm', missiles: 3, range: 2800, flight: 10, rel: 0.8, reload: 30, cost: 2, hard: 0 },
  { id: 'gw', name: 'USS George Washington', sub: 'SSBN-598 · Polaris A-1', lat: 69.5, lon: 3.0, kind: 'slbm', missiles: 8, range: 2600, flight: 10, rel: 0.82, reload: 50, cost: 2.5, hard: 1, mobile: true },
  { id: 'ph', name: 'USS Patrick Henry', sub: 'SSBN-599 · Polaris A-1', lat: 64.0, lon: -6.0, kind: 'slbm', missiles: 8, range: 2600, flight: 10, rel: 0.82, reload: 50, cost: 2.5, hard: 1, mobile: true },
  { id: 'loring', name: 'Loring AFB', sub: 'B-52 Stratofortress wing · Maine', lat: 46.95, lon: -67.89, kind: 'bomber', missiles: 6, range: 16000, flight: 34, rel: 0.95, reload: 35, cost: 2, hard: 0 },
  { id: 'thule', name: 'Thule AB', sub: 'BMEWS early-warning radar · Greenland', lat: 76.53, lon: -68.7, kind: 'radar', missiles: 0, range: 0, flight: 0, rel: 0, reload: 0, cost: 0, hard: 0.1 },
];

// conventional air bases for tactical strikes (range in km)
export const AIR_BASES = [
  { id: 'homestead', name: 'Homestead AFB', lat: 25.49, lon: -80.38, range: 900 },
  { id: 'ramstein', name: 'Ramstein AB', lat: 49.44, lon: 7.6, range: 900 },
  { id: 'lakenheath', name: 'RAF Lakenheath', lat: 52.41, lon: 0.56, range: 1100 },
];

// Soviet strategic targets. kind decides behaviour. salvo = missiles/sorties held,
// every = sim seconds between launches, hard = damage resistance (0..1).
export const SOVIET_TARGETS = [
  { id: 'plesetsk', name: 'Plesetsk Cosmodrome', sub: 'R-7 / R-16 ICBM complex', lat: 62.93, lon: 40.58, kind: 'icbm', salvo: 6, every: 105, hard: 0.3 },
  { id: 'tyuratam', name: 'Tyuratam (Baikonur)', sub: 'R-7 ICBM pads', lat: 45.92, lon: 63.34, kind: 'icbm', salvo: 4, every: 135, hard: 0.2 },
  { id: 'yurya', name: 'Yurya Missile Division', sub: 'R-16 ICBM regiment', lat: 59.03, lon: 49.28, kind: 'icbm', salvo: 5, every: 115, hard: 0.3 },
  { id: 'kozelsk', name: 'Kozelsk Missile Division', sub: 'R-16 ICBM regiment', lat: 54.03, lon: 35.77, kind: 'icbm', salvo: 4, every: 125, hard: 0.3 },
  { id: 'nizhny', name: 'Nizhny Tagil', sub: 'R-16 ICBM regiment', lat: 57.9, lon: 59.97, kind: 'icbm', salvo: 4, every: 125, hard: 0.3 },
  { id: 'engels', name: 'Engels Air Base', sub: 'M-4 / 3M strategic bombers', lat: 51.48, lon: 46.2, kind: 'bomber', salvo: 5, every: 95, hard: 0 },
  { id: 'olenya', name: 'Olenya Air Base', sub: 'Tu-95 forward bomber staging', lat: 68.15, lon: 33.46, kind: 'bomber', salvo: 4, every: 105, hard: 0 },
  { id: 'ukrainka', name: 'Ukrainka Air Base', sub: 'Tu-95 bombers · Far East', lat: 51.17, lon: 128.45, kind: 'bomber', salvo: 4, every: 115, hard: 0 },
  { id: 'severomorsk', name: 'Severomorsk', sub: 'Northern Fleet · Golf-class missile subs', lat: 69.07, lon: 33.42, kind: 'sub', salvo: 4, every: 140, hard: 0.1 },
  { id: 'vladivostok', name: 'Vladivostok', sub: 'Pacific Fleet submarine base', lat: 43.1, lon: 131.9, kind: 'sub', salvo: 3, every: 160, hard: 0.1 },
  { id: 'sancristobal', name: 'San Cristóbal MRBM Site', sub: 'R-12 missiles · Cuba', lat: 22.72, lon: -83.05, kind: 'mrbm', salvo: 6, every: 60, hard: 0, cuba: true },
  { id: 'sagua', name: 'Sagua la Grande MRBM Site', sub: 'R-12 missiles · Cuba', lat: 22.81, lon: -80.07, kind: 'mrbm', salvo: 6, every: 65, hard: 0, cuba: true },
  { id: 'guanajay', name: 'Guanajay IRBM Site', sub: 'R-14 pads under construction · Cuba', lat: 22.92, lon: -82.68, kind: 'mrbm', salvo: 4, every: 75, hard: 0, cuba: true },
  { id: 'belarus', name: 'Lida Missile Brigade', sub: 'R-12 IRBMs aimed at NATO Europe', lat: 53.88, lon: 25.3, kind: 'irbm', salvo: 6, every: 85, hard: 0.1 },
  { id: 'ukraine', name: 'Pervomaysk Missile Brigade', sub: 'R-14 IRBMs aimed at NATO Europe', lat: 48.05, lon: 30.85, kind: 'irbm', salvo: 5, every: 95, hard: 0.1 },
  { id: 'vlasikha', name: 'SRF Headquarters, Vlasikha', sub: 'Strategic Rocket Forces command bunker', lat: 55.68, lon: 37.18, kind: 'command', salvo: 0, every: 0, hard: 0.6 },
  { id: 'wunsdorf', name: 'Wünsdorf HQ', sub: 'Group of Soviet Forces in Germany · supply', lat: 52.18, lon: 13.47, kind: 'supply', salvo: 0, every: 0, hard: 0.2 },
  { id: 'legnica', name: 'Legnica Rail Hub', sub: 'Northern Group of Forces · reinforcement route', lat: 51.2, lon: 16.16, kind: 'supply', salvo: 0, every: 0, hard: 0 },
  { id: 'brest', name: 'Brest Rail Junction', sub: 'Gauge-change yards feeding the front', lat: 52.1, lon: 23.7, kind: 'supply', salvo: 0, every: 0, hard: 0 },
];

// Sites found later in the crisis by CORONA satellite film. reveal = game day.
export const HIDDEN_TARGETS = [
  { id: 'svobodny', name: 'Svobodny Missile Division', sub: 'R-16 ICBM regiment · Far East', lat: 51.4, lon: 128.1, kind: 'icbm', salvo: 4, every: 120, hard: 0.3, reveal: 2.5 },
  { id: 'kartaly', name: 'Kartaly Missile Regiment', sub: 'R-16 ICBM regiment · Urals', lat: 53.05, lon: 60.65, kind: 'icbm', salvo: 4, every: 120, hard: 0.3, reveal: 4 },
  { id: 'mozdok', name: 'Mozdok Air Base', sub: 'M-4 Bison bombers · Caucasus', lat: 43.75, lon: 44.65, kind: 'bomber', salvo: 4, every: 110, hard: 0, reveal: 4 },
  { id: 'gadzhiyevo', name: 'Gadzhiyevo', sub: 'Hotel-class missile submarine base', lat: 69.25, lon: 33.33, kind: 'sub', salvo: 3, every: 140, hard: 0.1, reveal: 5.5 },
  { id: 'shadrinsk', name: 'Shadrinsk Missile Regiment', sub: 'R-16 ICBM regiment', lat: 56.08, lon: 63.63, kind: 'icbm', salvo: 4, every: 120, hard: 0.4, reveal: 5.5 },
  { id: 'dyagilevo', name: 'Dyagilevo Air Base', sub: 'Tu-16 bombers · Ryazan', lat: 54.64, lon: 39.57, kind: 'bomber', salvo: 4, every: 110, hard: 0, reveal: 7 },
  { id: 'drovyanaya', name: 'Drovyanaya Missile Regiment', sub: 'R-16 ICBM regiment · Transbaikal', lat: 51.5, lon: 113.1, kind: 'icbm', salvo: 4, every: 125, hard: 0.4, reveal: 7 },
  { id: 'uzhur', name: 'Uzhur Missile Division', sub: 'R-16 ICBM regiment · Siberia', lat: 55.3, lon: 89.8, kind: 'icbm', salvo: 5, every: 115, hard: 0.5, reveal: 9 },
  { id: 'tatishchevo', name: 'Tatishchevo Missile Division', sub: 'R-16 ICBM regiment · Volga', lat: 51.7, lon: 45.6, kind: 'icbm', salvo: 4, every: 120, hard: 0.5, reveal: 9 },
];

// 1960 metro populations, millions
export const CITIES = [
  { id: 'nyc', name: 'New York', lat: 40.71, lon: -74.0, pop: 10.7 },
  { id: 'chi', name: 'Chicago', lat: 41.88, lon: -87.63, pop: 6.2 },
  { id: 'la', name: 'Los Angeles', lat: 34.05, lon: -118.24, pop: 6.0 },
  { id: 'phl', name: 'Philadelphia', lat: 39.95, lon: -75.17, pop: 4.3 },
  { id: 'det', name: 'Detroit', lat: 42.33, lon: -83.05, pop: 3.8 },
  { id: 'sf', name: 'San Francisco', lat: 37.77, lon: -122.42, pop: 2.6 },
  { id: 'bos', name: 'Boston', lat: 42.36, lon: -71.06, pop: 2.6 },
  { id: 'pit', name: 'Pittsburgh', lat: 40.44, lon: -79.99, pop: 2.4 },
  { id: 'stl', name: 'St. Louis', lat: 38.63, lon: -90.2, pop: 2.1 },
  { id: 'dc', name: 'Washington', lat: 38.9, lon: -77.04, pop: 2.0 },
  { id: 'cle', name: 'Cleveland', lat: 41.5, lon: -81.69, pop: 1.8 },
  { id: 'bal', name: 'Baltimore', lat: 39.29, lon: -76.61, pop: 1.7 },
  { id: 'hou', name: 'Houston', lat: 29.76, lon: -95.37, pop: 1.4 },
  { id: 'sea', name: 'Seattle', lat: 47.61, lon: -122.33, pop: 1.1 },
  { id: 'atl', name: 'Atlanta', lat: 33.75, lon: -84.39, pop: 1.0 },
  { id: 'mia', name: 'Miami', lat: 25.76, lon: -80.19, pop: 0.9 },
  { id: 'nola', name: 'New Orleans', lat: 29.95, lon: -90.07, pop: 0.9 },
  { id: 'den', name: 'Denver', lat: 39.74, lon: -104.99, pop: 0.9 },
];

// ground formations. type: armor | infantry | airborne | cavalry | marine
export const UNITS = [
  { name: '3rd Armored Division', short: '3 AD', side: 'nato', type: 'armor', lat: 50.13, lon: 8.92 },
  { name: '8th Infantry Division', short: '8 ID', side: 'nato', type: 'infantry', lat: 50.35, lon: 9.35 },
  { name: '14th Armored Cavalry Regt', short: '14 ACR', side: 'nato', type: 'cavalry', lat: 50.6, lon: 9.7 },
  { name: '3rd Infantry Division', short: '3 ID', side: 'nato', type: 'infantry', lat: 49.79, lon: 9.95 },
  { name: '4th Armored Division', short: '4 AD', side: 'nato', type: 'armor', lat: 49.45, lon: 11.0 },
  { name: '24th Infantry Division', short: '24 ID', side: 'nato', type: 'infantry', lat: 48.37, lon: 10.9 },
  { name: 'I (British) Corps', short: 'I BR', side: 'nato', type: 'armor', lat: 52.3, lon: 9.75 },
  { name: 'Bundeswehr I Korps', short: 'I KORPS', side: 'nato', type: 'infantry', lat: 53.4, lon: 10.1 },
  { name: 'Berlin Brigade', short: 'BERLIN', side: 'nato', type: 'infantry', lat: 52.48, lon: 13.3, str: 60 },
  { name: '82nd Airborne Division', short: '82 ABN', side: 'nato', type: 'airborne', lat: 35.14, lon: -79.0 },
  { name: '101st Airborne Division', short: '101 ABN', side: 'nato', type: 'airborne', lat: 36.66, lon: -87.47 },
  { name: '1st Armored Division', short: '1 AD', side: 'nato', type: 'armor', lat: 31.87, lon: -81.61 },
  { name: '2nd Marine Division', short: '2 MAR', side: 'nato', type: 'marine', lat: 34.67, lon: -77.35 },
  { name: '8th Guards Army', short: '8 GDS', side: 'ussr', type: 'infantry', lat: 50.98, lon: 11.32 },
  { name: '1st Guards Tank Army', short: '1 GTA', side: 'ussr', type: 'armor', lat: 51.05, lon: 13.0 },
  { name: '3rd Shock Army', short: '3 SHK', side: 'ussr', type: 'armor', lat: 52.13, lon: 11.62 },
  { name: '2nd Guards Tank Army', short: '2 GTA', side: 'ussr', type: 'armor', lat: 53.18, lon: 12.4 },
  { name: '20th Guards Army', short: '20 GDS', side: 'ussr', type: 'infantry', lat: 52.68, lon: 13.59 },
  { name: 'Czechoslovak 1st Army', short: 'CS 1A', side: 'ussr', type: 'infantry', lat: 49.75, lon: 13.38 },
  { name: 'Soviet Group of Forces, Cuba', short: 'GSVK', side: 'ussr', type: 'infantry', lat: 22.75, lon: -82.9, cuba: true },
  { name: 'Soviet Motor Rifle Regt', short: 'MRR', side: 'ussr', type: 'infantry', lat: 22.6, lon: -79.9, cuba: true },
  { name: 'Cuban Revolutionary Army', short: 'FAR', side: 'ussr', type: 'infantry', lat: 23.05, lon: -82.3, cuba: true },
];

export const OBJECTIVES = [
  { id: 'hamburg', name: 'Hamburg', lat: 53.55, lon: 9.99 },
  { id: 'hanover', name: 'Hanover', lat: 52.37, lon: 9.73 },
  { id: 'berlin', name: 'West Berlin', lat: 52.5, lon: 13.3 },
  { id: 'frankfurt', name: 'Frankfurt', lat: 50.11, lon: 8.68 },
  { id: 'nuremberg', name: 'Nuremberg', lat: 49.45, lon: 11.08 },
  { id: 'munich', name: 'Munich', lat: 48.14, lon: 11.58 },
];

export const SOVIET_SPAWNS = [
  { lat: 52.3, lon: 14.6 }, { lat: 51.3, lon: 14.9 }, { lat: 53.2, lon: 14.3 }, { lat: 50.2, lon: 14.4 },
];
export const SOVIET_UNIT_NAMES = ['Guards Tank Division', 'Motor Rifle Division', 'Polish 2nd Army', 'Guards Motor Rifle Div', 'NVA Panzer Division', 'Tank Division (2nd echelon)'];

export const FORT_HOOD = { lat: 31.13, lon: -97.78 };

export const COSTS = {
  shelters: 2, evacuate: 3, nike: 2.5, relief: 1.5, airstrike: 1, lift: 1.5, newDivision: 5, zeus: 12, siteRepair: 4,
};

export const CAMERA_PRESETS = {
  world: { lat: 42, lon: -10, dist: 24 },
  usa: { lat: 38, lon: -96, dist: 9 },
  europe: { lat: 51, lon: 11, dist: 3.4 },
  cuba: { lat: 25, lon: -81, dist: 3.2 },
  ussr: { lat: 56, lon: 50, dist: 10 },
};
