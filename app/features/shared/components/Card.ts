import styled from 'styled-components';

/**
 * Card surface shared by the welcome page cards. All cards use the same
 * width, padding, radius, border and shadow.
 */
const Card = styled.div`
    background: var(--card);
    border: 1px solid var(--card-line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 24px;
    width: 100%;
`;

export const CardTitle = styled.h2`
    color: var(--accent-text);
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.01em;
    margin: 0;
`;

export default Card;
