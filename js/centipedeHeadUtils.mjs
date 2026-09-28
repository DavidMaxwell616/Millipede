export function normalizeCentipedeBugHead(bug) {
    if (!bug) {
        return null;
    }

    if (!Array.isArray(bug.segments)) {
        bug.head = null;
        return bug;
    }

    bug.segments = bug.segments.filter(segment => segment && segment.active !== false);

    if (bug.segments.length === 0) {
        bug.head = null;
        return bug;
    }

    const leadingSegment = bug.segments[0];
    const validHead = bug.head && bug.segments.includes(bug.head) ? bug.head : null;
    bug.head = validHead === leadingSegment ? validHead : leadingSegment;

    bug.segments.forEach((segment, index) => {
        if (!segment || typeof segment.setData !== 'function') {
            return;
        }

        segment.setData('bug', bug);
        segment.setData('isHead', index === 0);
    });

    if (bug.head && typeof bug.head.setData === 'function') {
        bug.head.setData('bug', bug);
        bug.head.setData('isHead', true);
    }

    return bug;
}
