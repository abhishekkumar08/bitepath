import { plateItems } from '@/engine/totals';
import type { Catalogue, Food, Portion } from '@/engine/types';
import type { FoodLook, FoodLookBase, FoodModelId, FoodPiece } from '@/scene/food/types';

const MAX_LOOKS = 6;

const look = (
  model: FoodModelId,
  piece: FoodPiece,
  colors: number[],
  chyme: number,
  liquid = false,
): FoodLookBase => ({ model, piece, colors, chyme, liquid });

export const DISH_LOOKS: Record<string, FoodLookBase> = {
  chai: look('cup-hot', 'droplet', [0xb98a5c], 0xc9a47a, true),
  'black-coffee': look('cup-hot', 'droplet', [0x3b2417], 0x6b4a33, true),
  cola: look('glass-drink', 'droplet', [0x2a1710], 0x6a4a38, true),
  beer: look('glass-beer', 'droplet', [0xe0a82e, 0xf3e3b0], 0xcdb372, true),
  'red-wine': look('glass-wine', 'droplet', [0x6d1224], 0x8a5a55, true),
  'white-rice': look('rice', 'grain', [0xf4efe2], 0xece3cc),
  'brown-rice': look('rice', 'grain', [0xb08a5c, 0xe9dfc9], 0xc9b48e),
  roti: look('flatbread', 'crumb', [0xd2a566, 0x9c6b33], 0xd6bf94),
  'toor-dal': look('bowl-curry', 'droplet', [0xe0a928, 0xb8741f], 0xd4b46a, true),
  samosa: look('samosa', 'crumb', [0xd9a441, 0x8a5a1f, 0xe8cd6a], 0xd2b27a),
  poha: look('poha', 'grain', [0xe8c547, 0x5c8a3a], 0xddc980),
  idli: look('idli', 'morsel', [0xf6f1e4], 0xece4d0),
  paneer: look('cubes', 'morsel', [0xf7f3e6], 0xefe6cf),
  'boiled-egg': look('egg', 'morsel', [0xf8f4ea, 0xf0b92a], 0xecd9a0),
  banana: look('banana', 'morsel', [0xf2d04a], 0xe0cc88),
  palak: look('greens', 'leaf', [0x2f6b2c, 0x1f4d22], 0x8f9a5e),
  oats: look('bowl-white', 'morsel', [0xe8d9b5], 0xdfd0ab),
  curd: look('bowl-white', 'morsel', [0xfbf9f2], 0xf0e8d6),
  apple: look('apple', 'morsel', [0xc8312b, 0xe8d98a], 0xd4b58a),
  'orange-juice': look('glass-drink', 'droplet', [0xf08c1a], 0xdcb072, true),
  'french-fries': look('fries', 'morsel', [0xe5b448], 0xdcc088),
  'white-bread': look('bread', 'crumb', [0xf0dfb8, 0xd9b777], 0xe6d4aa),
};

const words = (alternatives: string): RegExp => new RegExp(`\\b(?:${alternatives})(?:e?s)?\\b`, 'i');

interface KeywordRow {
  pattern: RegExp;
  look: FoodLookBase;
  whole?: boolean;
}

const row = (alternatives: string, base: FoodLookBase, whole = false): KeywordRow => ({ pattern: words(alternatives), look: base, whole });

const BEER = look('glass-beer', 'droplet', [0xe0a82e, 0xf3e3b0], 0xcdb372, true);
const WINE = look('glass-wine', 'droplet', [0x6d1224], 0x8a5a55, true);
const HOT_DRINK = look('cup-hot', 'droplet', [0x6b4a33], 0x8a6f55, true);
const COLA = look('glass-drink', 'droplet', [0x2a1710], 0x6a4a38, true);
const MILK = look('glass-drink', 'droplet', [0xf7f3ea], 0xf0e8d6, true);
const SOFT_DRINK = look('glass-drink', 'droplet', [0xd8b36a], 0xd9c29a, true);
const SWEET = look('bread', 'crumb', [0xc9966b, 0x8a5a3a], 0xcdb08c);
const SNACK = look('bread', 'crumb', [0xe2b862, 0xc98f3a], 0xd9bf8a);
const SAUCE = look('bowl-curry', 'morsel', [0xc0762f, 0x8a4a1f], 0xcfa46a);
const NUT = look('chunk', 'crumb', [0xb98a52, 0x8a5e30], 0xc9ad84);
const VEGETABLE = look('cubes', 'morsel', [0xe08a3a, 0x7aa03f], 0xd9b88a);
const WHEAT = look('chunk', 'crumb', [0xe3cd8e], 0xe0d0a6);

const DRINK_ROWS: KeywordRow[] = [
  row('beer|ale|lager', BEER),
  row('wine|liqueur|sake|vodka|whiskey|whisky|gin|rum|brandy|tequila|alcoholic|champagne|sherry|vermouth|cognac', WINE),
  row('coffee|tea|espresso|cappuccino|latte', HOT_DRINK),
  row('cola|carbonated|soda|pop', COLA),
];

const DRINK_LEAD = /\b(?:beverage|drink|smoothie|shake|soda|liqueur|lemonade|punch|nectar|cider)(?:e?s)?\b|^water(?:,|$)/i;

const KEYWORD_ROWS: KeywordRow[] = [
  row('fries|french fried', look('fries', 'morsel', [0xe5b448], 0xdcc088), true),
  { pattern: /^potatoes?\b.*\b(?:mashed|dehydrated|flakes|granules)\b/i, look: look('bowl-white', 'morsel', [0xf0e2b8], 0xe6d9b4), whole: true },
  { pattern: /^cream, sour\b/i, look: look('bowl-white', 'morsel', [0xfbf9f2], 0xf0e8d6), whole: true },
  ...DRINK_ROWS,
  row('juice', look('glass-drink', 'droplet', [0xf08c1a], 0xdcb072, true)),
  row('soup|broth|stock|bouillon|consomme', look('bowl-curry', 'droplet', [0xd9a441, 0xa8641f], 0xd4b46a, true)),
  row('infant formula|formula', MILK),
  row('oil', look('glass-drink', 'droplet', [0xe8c04a], 0xd8c27e, true)),
  row('fish|shrimp|prawn|tuna|salmon|crab|lobster|mollusk|crustacean|oyster|clam|squid|octopus|mussel|scallop|abalone|cuttlefish|crayfish|anchov(?:y|ies)|sardine|cod|eel|roe|caviar', look('fish', 'morsel', [0xe8a58c, 0xf2d6c4], 0xd9b9a3)),
  row('beef|pork|lamb|mutton|chicken|turkey|goat|ham|bacon|sausage|veal|game meat|ostrich|emu|frankfurter|bologna|salami|pepperoni|hot dog|luncheon meat|liver|kidney|tripe|giblets|venison|bison|rabbit|duck|goose|pheasant|elk|moose|caribou|buffalo|squab|meat|kielbasa|chorizo|meatball|jerky|pastrami|prosciutto|corned beef|sheep|spleen|lungs|brain|gizzard|tongue|boar|whale|walrus|beefalo|calf', look('meat', 'morsel', [0xb4604f, 0xd9a58f], 0xb99c85)),
  row('egg', look('egg', 'morsel', [0xf8f4ea, 0xf0b92a], 0xecd9a0)),
  row('sugar|sweetener', look('cubes', 'grain', [0xf4f1ea], 0xece3cc)),
  row('cake|cookie|biscuit|candy|candies|chocolate|pastr(?:y|ies)|pie|jam|jell(?:y|ies)|jaggery|ice cream|frozen novelt(?:y|ie)|dessert|sweet(?! potato)|pudding|custard|halwa|laddu|barfi|doughnut|donut|muffin|brownie|waffle|pancake|gelatin|fudge|marshmallow|frosting|icing|toffee|caramel|honey|topping', SWEET),
  row('snack|chips|crisps|puffs|popcorn|cracker|pretzel', SNACK),
  row('nuts?|\\w+nuts?|almond|peanut|cashew|walnut|pistachio|hazelnut|pecan|macadamia|sesame|flaxseed|chia|seeds?|tahini|marzipan', NUT),
  { pattern: /\b(?:butter|ghee|lard|margarine|shortening|tallow|suet|animal fat)\b/i, look: look('chunk', 'morsel', [0xf1d77a], 0xe3d092) },
  row('sauce|gravy|gravies|dressing|mayonnaise|ketchup|catsup|syrup|dip|salsa|spread|marinade|chutney|pickle|paste|puree|mustard(?! greens)|vinegar', SAUCE),
  row('pasta|noodle|macaroni|spaghetti|vermicelli|lasagna|ravioli|couscous', WHEAT),
  row('rice|risotto|pilaf|biryani', look('rice', 'grain', [0xf4efe2], 0xece3cc)),
  row('roti|chapati|chapatti|naan|paratha|tortilla|pita|puri|pizza|dosa', look('flatbread', 'crumb', [0xd2a566, 0x9c6b33], 0xd6bf94), true),
  row('bread|toast|bun|bagel|roll|sandwich|burger|hamburger|cheeseburger|croissant|stuffing|cornbread|big mac|taco|burrito', look('bread', 'crumb', [0xf0dfb8, 0xd9b777], 0xe6d4aa)),
  row('oat|oatmeal|cereal|porridge|muesli|granola|ragi|millet|wheat|barley|flour|atta|semolina|cornmeal|grits|bulgur|quinoa|sorghum|maize|bajra|jowar|tapioca|arrowroot|starch|farina|rye|buckwheat|teff|spelt|triticale|bran', look('bowl-white', 'morsel', [0xe8d9b5], 0xdfd0ab)),
  row('yogurt|yoghurt|curd|dahi|kefir', look('bowl-white', 'morsel', [0xfbf9f2], 0xf0e8d6)),
  row('cheese|paneer', look('cubes', 'morsel', [0xf3e3a8], 0xefe0b8)),
  row('\\w*milk|cream|lassi|whey|half and half|eggnog', MILK),
  row('apple|applesauce', look('apple', 'morsel', [0xc8312b, 0xe8d98a], 0xd4b58a)),
  row('banana|plantain', look('banana', 'morsel', [0xf2d04a], 0xe0cc88)),
  row('orange|lemon|lime|mandarin|tangerine|grapefruit|citrus|kumquat|pomelo', look('fruit', 'morsel', [0xf08c1a], 0xdcb072)),
  row('mango|grape|pear|peach|plum|\\w*cherr(?:y|ies)|\\w*berr(?:y|ies)|melon|pineapple|papaya|guava|pomegranate|apricot|fig|kiwi|fruit|currant|raisin|date|prune|lychee|persimmon|jack ?fruit|nectarine|tamarind|avocado|olive|rhubarb|coconut|sapota|jamun|amla|custard-apple', look('fruit', 'morsel', [0xe0703a, 0xf2b84a], 0xd9b88a)),
  row('spinach|lettuce|cabbage|palak|kale|cress|amaranth|broccoli|coriander|mint|saag|leaf|leaves|greens|chard|collards|parsley|basil|celery|asparagus|arugula|endive|rapini|sprouts|seaweed|kelp|spirulina|herbs?', look('greens', 'leaf', [0x2f6b2c, 0x1f4d22], 0x8f9a5e)),
  row('mushroom|truffle|shiitake|morel', look('chunk', 'morsel', [0xd9cdb8, 0xb59f82], 0xd8cdb8)),
  row('spices?|seasoning|salt|baking|yeast|masala|curry powder|turmeric|cumin', look('chunk', 'crumb', [0x8a6a3a, 0xb8873a], 0xb39a70)),
  row('potato|yam|tuber|cassava|taro|colocasia', look('chunk', 'morsel', [0xe6cf94], 0xe0d2b4)),
  row('\\w*beans?|lentil|dal|gram|pea|chickpea|pulse|soy\\w*|tofu|hummus|falafel|lupin|cowpea|tempeh|miso|natto|edamame', look('bowl-curry', 'morsel', [0xc89b4a, 0x8a5a2a], 0xd4b46a)),
  row('squash|pumpkin|gourd|carrot|onion|tomato|tomatoe|cucumber|pepper|capsicum|eggplant|brinjal|cauliflower|beet|beetroot|radish|turnip|okra|corn|parsnip|rutabaga|leek|garlic|ginger|zucchini|jicama|kohlrabi|artichoke|bamboo shoots|vegetable|chili|chilies|jalapeno|lotus|bitter melon|knol|drumstick|shallot|scallion|fennel|celeriac|salad', VEGETABLE),
];

const FALLBACK = {
  fat: look('chunk', 'morsel', [0xe3c25a], 0xd8c27e),
  protein: look('chunk', 'morsel', [0xb9877a], 0xb99c85),
  carbs: look('chunk', 'crumb', [0xdcc9a1], 0xe0d2b4),
  fibre: look('greens', 'leaf', [0x6f9a4f], 0x9aa36a),
};

const FIBRE_HEAVY = 0.3;

function fallbackLook(food: Food): FoodLookBase {
  const { fat, protein, fibre, sugar, starch } = food.per100g;
  const carbs = sugar + starch;
  if (fibre > 0 && fibre / (fibre + carbs + protein + fat) > FIBRE_HEAVY) return FALLBACK.fibre;
  const energy = { fat: fat * 9, protein: protein * 4, carbs: carbs * 4 };
  if (energy.fat > energy.protein && energy.fat > energy.carbs) return FALLBACK.fat;
  if (energy.protein > energy.carbs) return FALLBACK.protein;
  return FALLBACK.carbs;
}

const isBrand = (lead: string): boolean => !/[a-z]/.test(lead) || /'s$/i.test(lead);

const matchSegment = (text: string, whole: string): FoodLookBase | null => {
  for (const r of KEYWORD_ROWS) if (r.pattern.test(r.whole ? whole : text)) return r.look;
  return null;
};

export function lookForFood(food: Food): FoodLookBase {
  const segments = food.name.split(',').map((segment) => segment.trim());
  const lead = segments[0] ?? food.name;
  if (DRINK_LEAD.test(lead)) {
    return DRINK_ROWS.find((r) => r.pattern.test(food.name))?.look ?? (words('milk|cream').test(food.name) ? MILK : SOFT_DRINK);
  }
  const fromLead = isBrand(lead) ? null : matchSegment(lead, food.name);
  if (fromLead) return fromLead;
  for (const segment of segments.slice(1)) {
    const found = KEYWORD_ROWS.find((r) => !r.whole && r.pattern.test(segment));
    if (found) return found.look;
  }
  return fallbackLook(food);
}

interface Entry {
  id: string;
  name: string;
  base: FoodLookBase;
  grams: number;
}

const portionEntry = (catalogue: Catalogue, portion: Portion): Entry | null => {
  const items = plateItems(catalogue, [portion]);
  const grams = items.reduce((acc, item) => acc + item.grams, 0);
  if (grams <= 0) return null;
  if (portion.kind === 'food') {
    const food = items[0]?.food;
    return food ? { id: food.id, name: food.name, base: lookForFood(food), grams } : null;
  }
  const dish = catalogue.dishes[portion.dishId];
  const heaviest = items.reduce<Entry | null>(
    (best, item) => (best && best.grams >= item.grams ? best : { id: item.food.id, name: item.food.name, base: lookForFood(item.food), grams: item.grams }),
    null,
  );
  const base = DISH_LOOKS[portion.dishId] ?? heaviest?.base;
  return dish && base ? { id: dish.id, name: dish.name, base, grams } : null;
};

const mergeTail = (tail: Entry[]): Entry => {
  const first = tail[0] as Entry;
  return {
    id: tail.map((e) => e.id).join('+'),
    name: tail.map((e) => e.name).join(', '),
    base: { ...first.base, model: 'chunk', piece: 'morsel', liquid: false },
    grams: tail.reduce((acc, e) => acc + e.grams, 0),
  };
};

export function looksFor(catalogue: Catalogue, portions: Portion[]): FoodLook[] {
  const byId = new Map<string, Entry>();
  for (const portion of portions) {
    const entry = portionEntry(catalogue, portion);
    if (!entry) continue;
    const seen = byId.get(entry.id);
    if (seen) seen.grams += entry.grams;
    else byId.set(entry.id, entry);
  }
  const sorted = [...byId.values()].sort((a, b) => b.grams - a.grams);
  const entries = sorted.length > MAX_LOOKS ? [...sorted.slice(0, MAX_LOOKS - 1), mergeTail(sorted.slice(MAX_LOOKS - 1))] : sorted;
  const total = entries.reduce((acc, e) => acc + e.grams, 0);
  return entries.map((e) => ({ id: e.id, name: e.name, ...e.base, colors: [...e.base.colors], share: e.grams / total }));
}
