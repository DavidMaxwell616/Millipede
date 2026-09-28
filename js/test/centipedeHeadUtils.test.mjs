import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeCentipedeBugHead } from '../centipedeHeadUtils.mjs';

function createSegment(label, { active = true, isHead = false } = {}) {
    const data = new Map();
    const segment = {
        label,
        active,
        body: {},
        getData(key) {
            return data.get(key);
        },
        setData(key, value) {
            data.set(key, value);
            return this;
        }
    };

    if (isHead) {
        segment.setData('isHead', true);
    }

    return segment;
}

test('normalizeCentipedeBugHead assigns the leading segment as the head when no head exists', () => {
    const lead = createSegment('lead');
    const tail = createSegment('tail');
    const bug = { segments: [lead, tail], head: null };

    normalizeCentipedeBugHead(bug);

    assert.equal(bug.head, lead);
    assert.equal(lead.getData('isHead'), true);
    assert.equal(tail.getData('isHead'), false);
});

test('normalizeCentipedeBugHead resets the head to the leading segment when a stale head remains', () => {
    const lead = createSegment('lead');
    const tail = createSegment('tail');
    const bug = { segments: [lead, tail], head: tail };

    normalizeCentipedeBugHead(bug);

    assert.equal(bug.head, lead);
    assert.equal(lead.getData('isHead'), true);
    assert.equal(tail.getData('isHead'), false);
});

test('normalizeCentipedeBugHead clears the head when the bug has no active segments', () => {
    const bug = {
        segments: [createSegment('inactive', { active: false })],
        head: { label: 'stale' }
    };

    normalizeCentipedeBugHead(bug);

    assert.equal(bug.head, null);
});
