const parsePageSelection = (input, totalPages) => {
  if (!totalPages) {
    return { pages: [], error: 'Unknown page count' };
  }

  if (!input || input.trim() === '' || input.trim() === '*') {
    const allPages = Array.from({ length: totalPages }, (_, index) => index);
    return { pages: allPages, error: null };
  }

  const cleanedInput = input.replace(/\s+/g, '');
  const segments = cleanedInput.split(',').filter(Boolean);

  if (segments.length === 0) {
    return { pages: [], error: 'Enter at least one page number or range' };
  }

  const pagesSet = new Set();

  for (const segment of segments) {
    const singlePageMatch = segment.match(/^\d+$/);
    const rangeMatch = segment.match(/^(\d+)-(\d+)$/);

    if (singlePageMatch) {
      const pageNumber = parseInt(singlePageMatch[0], 10);
      if (pageNumber < 1 || pageNumber > totalPages) {
        return { pages: [], error: `Page ${pageNumber} is out of bounds` };
      }
      pagesSet.add(pageNumber - 1);
      continue;
    }

    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);

      if (start > end) {
        return { pages: [], error: `Range ${segment} is invalid (start greater than end)` };
      }

      if (start < 1 || end > totalPages) {
        return { pages: [], error: `Range ${segment} is out of bounds` };
      }

      for (let page = start; page <= end; page += 1) {
        pagesSet.add(page - 1);
      }
      continue;
    }

    return { pages: [], error: `"${segment}" is not a valid page or range` };
  }

  if (pagesSet.size === 0) {
    return { pages: [], error: 'No valid pages selected' };
  }

  return { pages: Array.from(pagesSet).sort((a, b) => a - b), error: null };
};

export default parsePageSelection;
