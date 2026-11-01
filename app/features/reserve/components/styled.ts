import styled from 'styled-components';

export const Section = styled.section`
    border-bottom: 1px solid #333;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
`;

export const SectionTitle = styled.h3`
    color: #c6c6c6;
    font-size: 12px;
    font-weight: 600;
    margin: 0;
    text-transform: uppercase;
`;

export const Row = styled.div`
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
`;

export const Select = styled.select`
    background: #3e3e3e;
    border: 2px solid #3e3e3e;
    border-radius: 4px;
    color: #f4f5f7;
    flex: 1;
    font-size: 14px;
    padding: 6px 8px;
`;

export const SmallButton = styled.button<{ danger?: boolean; primary?: boolean; }>`
    background: ${p => (p.primary ? '#0073e0' : p.danger ? '#5c1f14' : '#3e3e3e')};
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font-size: 13px;
    padding: 5px 10px;

    &:hover:not(:disabled) {
        filter: brightness(1.2);
    }

    &:disabled {
        cursor: default;
        opacity: 0.5;
    }
`;

export const Notice = styled.div<{ kind: 'error' | 'info' | 'warning'; }>`
    background: ${p => (p.kind === 'error' ? '#5c1f14' : p.kind === 'warning' ? '#5c4a14' : '#1f3a5c')};
    border-radius: 4px;
    font-size: 13px;
    padding: 8px 10px;
`;

export const Progress = styled.progress`
    width: 100%;
`;

export const Muted = styled.span`
    color: #a0a0a0;
    font-size: 12px;
`;
