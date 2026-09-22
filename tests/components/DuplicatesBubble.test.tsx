import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DuplicatesBubble from '../../src/components/DuplicatesBubble';

const duplicates = [
  { date: '2026-09-13', description: 'הפקדת שיק', amount: 2550, type: 'income' as const },
  { date: '2026-09-15', description: 'פירעון הלוואה', amount: 1250, type: 'expense' as const },
];

// jsdom has no PointerEvent, so pointerType would never reach React's pointer handlers
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    class PointerEventPolyfill extends MouseEvent {
      pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerType = init.pointerType ?? '';
      }
    }
    Object.assign(window, { PointerEvent: PointerEventPolyfill });
  }
});

describe('DuplicatesBubble', () => {
  it('opens on tap/click and lists the duplicates newest first', () => {
    render(<DuplicatesBubble count={2} duplicates={duplicates} />);
    const trigger = screen.getByRole('button', { name: '2 duplicates skipped' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(trigger);
    const items = screen.getAllByRole('listitem');
    expect(items.map(li => li.textContent)).toEqual([
      expect.stringContaining('פירעון הלוואה'),
      expect.stringContaining('הפקדת שיק'),
    ]);
    expect(items[1].textContent).toContain('+₪2,550.00');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens on mouse hover and closes when the mouse leaves', () => {
    render(<DuplicatesBubble count={2} duplicates={duplicates} />);
    const container = screen.getByRole('button').parentElement!;
    fireEvent.pointerOver(container, { pointerType: 'mouse' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.pointerOut(container, { pointerType: 'mouse' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on Escape and on a click outside', () => {
    render(<div><DuplicatesBubble count={2} duplicates={duplicates} /><p>outside</p></div>);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button'));
    fireEvent.pointerDown(screen.getByText('outside'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('still explains itself when only a count is available', () => {
    render(<DuplicatesBubble count={1} />);
    fireEvent.click(screen.getByRole('button', { name: '1 duplicate skipped' }));
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('dialog')).toHaveTextContent('Already in your account');
  });
});
