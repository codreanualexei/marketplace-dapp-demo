import React from 'react';
import { NFTMetadata } from '../hooks/useNFTMetadata';
import './NFTMetadata.css';

interface NFTMetadataProps {
  metadata: NFTMetadata | null;
  isLoading?: boolean;
  fallbackName?: string;
}

export const NFTMetadataDisplay: React.FC<NFTMetadataProps> = ({
  metadata,
  isLoading = false,
  fallbackName,
}) => {
  if (isLoading) {
    return (
      <div className="nft-metadata">
        <div className="metadata-loading">
          <div className="loading-spinner-small"></div>
          <span>Loading metadata...</span>
        </div>
      </div>
    );
  }

  if (!metadata) {
    return null;
  }

  const description = metadata.description;
  const attributes = metadata.attributes || [];

  return (
    <div className="nft-metadata">
      {description && (
        <div className="metadata-description">
          <p>{description}</p>
        </div>
      )}

      {attributes.length > 0 && (
        <div className="metadata-attributes">
          <h5>Attributes</h5>
          <div className="attributes-grid">
            {attributes.map((attr, index) => {
              const traitType = attr.trait_type || `Attribute ${index + 1}`;
              const value = attr.value !== undefined ? String(attr.value) : '';
              
              return (
                <div key={index} className="attribute-item">
                  <span className="attribute-type">{traitType}</span>
                  <span className="attribute-value">{value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

