import type { Source } from '@/engine/types';

const OPENSTAX = 'https://openstax.org/books/anatomy-and-physiology-2e/pages/';

export const SOURCES: Record<string, Source> = {
  'openstax-23-3': {
    id: 'openstax-23-3',
    citation: 'OpenStax, Anatomy and Physiology 2e, §23.3 The Mouth, Pharynx, and Esophagus.',
    url: `${OPENSTAX}23-3-the-mouth-pharynx-and-esophagus`,
  },
  'openstax-23-4': {
    id: 'openstax-23-4',
    citation: 'OpenStax, Anatomy and Physiology 2e, §23.4 The Stomach.',
    url: `${OPENSTAX}23-4-the-stomach`,
  },
  'openstax-23-6': {
    id: 'openstax-23-6',
    citation: 'OpenStax, Anatomy and Physiology 2e, §23.6 Accessory Organs in Digestion: The Liver, Pancreas, and Gallbladder.',
    url: `${OPENSTAX}23-6-accessory-organs-in-digestion-the-liver-pancreas-and-gallbladder`,
  },
  'openstax-23-7': {
    id: 'openstax-23-7',
    citation: 'OpenStax, Anatomy and Physiology 2e, §23.7 Chemical Digestion and Absorption: A Closer Look.',
    url: `${OPENSTAX}23-7-chemical-digestion-and-absorption-a-closer-look`,
  },
  abell2008: {
    id: 'abell2008',
    citation: 'Abell TL et al. Consensus recommendations for gastric emptying scintigraphy. Am J Gastroenterol, 2008.',
    url: 'https://doi.org/10.1111/j.1572-0241.2007.01636.x',
  },
  wang2015: {
    id: 'wang2015',
    citation: 'Wang YT et al. Regional gastrointestinal transit and pH studied in 215 healthy volunteers using the wireless motility capsule. Aliment Pharmacol Ther, 2015.',
    url: 'https://doi.org/10.1111/apt.13329',
  },
  frezza1990: {
    id: 'frezza1990',
    citation: 'Frezza M et al. High blood alcohol levels in women: the role of decreased gastric alcohol dehydrogenase activity and first-pass metabolism. N Engl J Med, 1990.',
    url: 'https://doi.org/10.1056/NEJM199001113220205',
  },
  hurrell2010: {
    id: 'hurrell2010',
    citation: 'Hurrell R, Egli I. Iron bioavailability and dietary reference values. Am J Clin Nutr, 2010.',
    url: 'https://doi.org/10.3945/ajcn.2010.28674F',
  },
  fredholm1999: {
    id: 'fredholm1999',
    citation: 'Fredholm BB et al. Actions of caffeine in the brain with special reference to factors that contribute to its widespread use. Pharmacol Rev, 1999.',
    url: 'https://doi.org/10.1016/s0031-6997(24)01396-6',
  },
  denbesten2013: {
    id: 'denbesten2013',
    citation: 'den Besten G et al. The role of short-chain fatty acids in the interplay between diet, gut microbiota, and host energy metabolism. J Lipid Res, 2013.',
    url: 'https://doi.org/10.1194/jlr.R036012',
  },
};
