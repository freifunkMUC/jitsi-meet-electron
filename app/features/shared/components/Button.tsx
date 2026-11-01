
import React, { ReactNode } from 'react';
import styled from 'styled-components';

interface IStyleProps {
    appearance?: string;
    spacing?: string;
}

interface IProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    appearance?: string;
    children?: ReactNode;
    iconBefore?: ReactNode;
    spacing?: string;
}

const getPadding = (props: IStyleProps) => {
    if (props.spacing === 'none') {
        return '0';
    }

    return '8px 16px';
};

const getPrimaryStyles = (props: IStyleProps) => {
    if (props.appearance === 'primary') {
        return `
            background: var(--accent-grad);
            box-shadow: var(--accent-shadow);
            color: #ffffff;
            font-weight: 700;
            &:hover:not(:disabled) { filter: brightness(1.08); }
            &:active:not(:disabled) { transform: translateY(1px); }
        `;
    }

    return '';
};

const getSubtleStyles = (props: IStyleProps) => {
    if (props.appearance === 'subtle') {
        return `
            background: transparent;
            color: inherit;
            &:hover { background: var(--hover); }
        `;
    }

    return '';
};

const getDefaultStyles = (props: IStyleProps) => {
    if (props.appearance !== 'primary' && props.appearance !== 'subtle') {
        return `
            background: var(--btn-bg);
            border: 1px solid var(--line);
            color: var(--btn-text);
            &:hover:not(:disabled) { background: var(--btn-bg-hover); }
        `;
    }

    return '';
};

const StyledButton = styled.button<IStyleProps>`
    align-items: center;
    border: none;
    border-radius: 14px;
    cursor: pointer;
    display: inline-flex;
    font-size: 14px;
    font-weight: 600;
    gap: 6px;
    justify-content: center;
    outline: none;
    padding: ${getPadding};
    transition: background 0.15s, filter 0.15s;

    &:disabled {
        cursor: default;
        opacity: 0.55;
    }

    ${getPrimaryStyles}
    ${getSubtleStyles}
    ${getDefaultStyles}
`;

/**
 * Simple button component that replaces @atlaskit/button.
 *
 * @param {IProps} props - Component props.
 * @returns {ReactElement}
 */
const Button = ({ iconBefore, children, ...rest }: IProps) => (
    <StyledButton { ...rest }>
        { iconBefore }
        { children }
    </StyledButton>
);

export default Button;
