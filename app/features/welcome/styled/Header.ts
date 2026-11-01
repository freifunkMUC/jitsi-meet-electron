
import styled from 'styled-components';

// One column for the welcome cards, so that they share width and spacing.
export default styled.div`
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 0 auto;
    max-width: 720px;
    padding: 32px 24px 8px;
    width: 100%;
`;
