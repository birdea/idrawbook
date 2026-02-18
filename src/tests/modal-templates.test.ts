import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { injectModals, MODAL_TEMPLATES } from '../ui/modal-templates';

describe('Modal Templates', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should inject all modals into the body', () => {
        injectModals();

        // Check for specific modals
        expect(document.getElementById('save-modal')).not.toBeNull();
        expect(document.getElementById('mobile-bottom-bar')).not.toBeNull();
        expect(document.getElementById('mobile-generic-modal')).not.toBeNull();
        expect(document.getElementById('settings-modal')).not.toBeNull();
        expect(document.getElementById('new-book-modal')).not.toBeNull();
        expect(document.getElementById('new-page-modal')).not.toBeNull();
        expect(document.getElementById('open-book-modal')).not.toBeNull();

        // Verify content counts
        const modals = document.querySelectorAll('.modal-overlay');
        // save, mobileGeneric, settings, newBook, newPage, openBook = 6
        // mobile-bottom-bar is separate
        expect(modals.length).toBe(6);
    });

    it('should contain correct structure in templates', () => {
        // Just spot check one template string
        expect(MODAL_TEMPLATES.save).toContain('id="save-modal"');
        expect(MODAL_TEMPLATES.save).toContain('Save File');
    });
});
