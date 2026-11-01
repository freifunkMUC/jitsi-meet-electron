
import styled from 'styled-components';

export default styled.div`
    background: var(--card);
    border: 1px solid var(--card-line);
    border-left: 4px solid var(--accent);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow);
    color: var(--text);
    display: grid;
    grid-template-rows: repeat(3, auto);
    grid-template-columns: 1fr auto;
    grid-auto-flow: column;
    font-size: 0.9em;
    margin: 0.5em;
    padding: 1em;

    &:hover {
        background: var(--hover);
        cursor: pointer;
    }
`;
