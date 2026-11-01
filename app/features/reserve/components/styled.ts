import styled from 'styled-components';

export const Section = styled.section`
    background: var(--card);
    border: 1px solid var(--card-line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
`;

export const SectionTitle = styled.h3`
    color: var(--muted);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    margin: 0;
    text-transform: uppercase;
`;

export const Row = styled.div`
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
`;

export const Select = styled.select`
    background: var(--input-bg);
    border: 1px solid var(--input-line);
    border-radius: var(--radius-sm);
    color: var(--text);
    flex: 1;
    font-size: 14px;
    min-width: 0;
    padding: 8px 10px;

    &:focus {
        border-color: var(--focus-ring);
        outline: none;
    }
`;

export const SmallButton = styled.button<{ danger?: boolean; primary?: boolean; }>`
    background: ${p => (p.primary ? 'var(--accent-grad)' : p.danger ? 'var(--danger-btn-bg)' : 'var(--btn-bg)')};
    border: 1px solid ${p => (p.primary ? 'transparent' : 'var(--line)')};
    border-radius: 10px;
    box-shadow: ${p => (p.primary ? 'var(--accent-shadow)' : 'none')};
    color: ${p => (p.primary ? '#ffffff' : p.danger ? 'var(--danger-btn-text)' : 'var(--btn-text)')};
    cursor: pointer;
    font-size: 13px;
    font-weight: ${p => (p.primary ? 700 : 600)};
    padding: 7px 12px;
    transition: background 0.15s, filter 0.15s;

    &:hover:not(:disabled) {
        background: ${p => (p.primary ? 'var(--accent-grad)' : p.danger ? 'var(--danger-btn-bg)' : 'var(--btn-bg-hover)')};
        filter: ${p => (p.primary || p.danger ? 'brightness(1.08)' : 'none')};
    }

    &:disabled {
        cursor: default;
        opacity: 0.5;
    }
`;

const NOTICE = {
    error: [ 'var(--notice-error-bg)', 'var(--notice-error-line)', 'var(--notice-error-text)' ],
    info: [ 'var(--notice-info-bg)', 'var(--notice-info-line)', 'var(--notice-info-text)' ],
    warning: [ 'var(--notice-warn-bg)', 'var(--notice-warn-line)', 'var(--notice-warn-text)' ]
};

export const Notice = styled.div<{ kind: 'error' | 'info' | 'warning'; }>`
    background: ${p => NOTICE[p.kind][0]};
    border: 1px solid ${p => NOTICE[p.kind][1]};
    border-radius: var(--radius-sm);
    color: ${p => NOTICE[p.kind][2]};
    font-size: 13px;
    padding: 10px 12px;
`;

export const Progress = styled.progress`
    accent-color: var(--accent);
    flex: 1;
`;

export const Muted = styled.span`
    color: var(--muted);
    font-size: 12px;
`;

export const Hint = styled.p`
    color: var(--muted);
    font-size: 12.5px;
    line-height: 1.45;
    margin: 0;
`;

export type BadgeRole = 'host' | 'speaker' | 'viewer';

export const Badge = styled.span<{ $role: BadgeRole; }>`
    background: var(--badge-${p => p.$role}-bg);
    border-radius: 999px;
    color: var(--badge-${p => p.$role}-text);
    display: inline-block;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 3px 9px;
    text-transform: uppercase;
    white-space: nowrap;
`;
