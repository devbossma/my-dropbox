import React from 'react';
import './LoginBackground.css';
import cloudRegular from '../../assets/cloud-regular-full.svg';
import cloudSolid from '../../assets/cloud-solid-full.svg';

const LoginBackground: React.FC = () => {
    return (
        <div className="login-animation-container">
            <div className="clouds-layer">
                {/* Regular Clouds - Layer 1 */}
                <img src={cloudRegular} className="cloud cloud-1" alt="" />
                <img src={cloudRegular} className="cloud cloud-2" alt="" />
                <img src={cloudRegular} className="cloud cloud-3" alt="" />

                {/* Solid Clouds - Layer 2 (Parallax) */}
                <img src={cloudSolid} className="cloud cloud-4" alt="" />
                <img src={cloudSolid} className="cloud cloud-5" alt="" />
                <img src={cloudSolid} className="cloud cloud-6" alt="" />

                {/* More Clouds for depth */}
                <img src={cloudRegular} className="cloud cloud-7" alt="" />
                <img src={cloudSolid} className="cloud cloud-8" alt="" />
            </div>
            <div className="sky-gradient"></div>
        </div>
    );
};

export default LoginBackground;
