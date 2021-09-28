import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { camelCaseObject, getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import {
  FormattedMessage, injectIntl, intlShape,
} from '@edx/frontend-platform/i18n';
import { Lightbulb, MoneyFilled } from '@edx/paragon/icons';
import {
  Alert, Icon, ModalDialog,
} from '@edx/paragon';
import { layoutGenerator } from 'react-break';
import { useDispatch } from 'react-redux';
import { UpgradeNowButton } from '../../generic/upgrade-button';

import { useModel } from '../../generic/model-store';
import StreakMobileImage from './assets/Streak_mobile.png';
import StreakDesktopImage from './assets/Streak_desktop.png';
import messages from './messages';
import { recordModalClosing, recordStreakCelebration } from './utils';

function getRandomFactoid(intl, streakLength) {
  const boldedSectionA = intl.formatMessage(messages.streakFactoidABoldedSection);
  const boldedSectionB = intl.formatMessage(messages.streakFactoidBBoldedSection);
  const factoids = [
    (<FormattedMessage
      id="learning.streakcelebration.factoida"
      defaultMessage="Users who learn {streak_length} days in a row {bolded_section} than those who don’t."
      values={{
        bolded_section: (<b>{boldedSectionA}</b>),
        streak_length: (streakLength),
      }}
    />),
    (<FormattedMessage
      id="learning.streakcelebration.factoidb"
      defaultMessage="Users who learn {streak_length} days in a row {bolded_section} vs. those who don’t."
      values={{
        bolded_section: (<b>{boldedSectionB}</b>),
        streak_length: (streakLength),
      }}
    />),
  ];
  return factoids[Math.floor(Math.random() * (factoids.length))];
}

async function calculateVoucherDiscount(voucher, sku, username) {
  const urlBase = `${getConfig().ECOMMERCE_BASE_URL}/api/v2/baskets/calculate`;
  const url = `${urlBase}/?code=${voucher}&sku=${sku}&username=${username}`;
  return getAuthenticatedHttpClient().get(url)
    .then(res => camelCaseObject(res));
}

function StreakModal({
  courseId, metadataModel, streakLengthToCelebrate, intl, isStreakCelebrationOpen,
  closeStreakCelebration, StreakDiscountCouponEnabled, verifiedMode, ...rest
}) {
  if (!isStreakCelebrationOpen) {
    return null;
  }
  const { org, celebrations, username } = useModel(metadataModel, courseId);
  const factoid = getRandomFactoid(intl, streakLengthToCelebrate);
  // eslint-disable-next-line no-unused-vars
  const [randomFactoid, setRandomFactoid] = useState(factoid); // Don't change factoid on re-render

  const [discountPercent, setDiscountPercent] = useState(0);

  const layout = layoutGenerator({
    mobile: 0,
    desktop: 575,
  });

  const OnMobile = layout.is('mobile');
  const OnDesktop = layout.isAtLeast('desktop');
  const dispatch = useDispatch();

  useEffect(() => {
    if (isStreakCelebrationOpen) {
      recordStreakCelebration(org, courseId);
    }
  }, [isStreakCelebrationOpen, org, courseId]);

  // Ask ecommerce to calculate discount savings
  useEffect(() => {
    if (verifiedMode && getConfig().ECOMMERCE_BASE_URL) {
      // Open edX Folks! If you create a voucher with this code, we'll notice and show the discount in the streak modal
      calculateVoucherDiscount('ZGY11119949', verifiedMode.sku, username)
        .then(
          (result) => {
            const { totalInclTax, totalInclTaxExclDiscounts } = result.data;
            if (totalInclTaxExclDiscounts && totalInclTax !== totalInclTaxExclDiscounts) {
              // Just store the percent (rather than using these values directly), because ecommerce doesn't give us
              // the currency symbol to use. So we'll keep using the values in verifiedMode, just multiplied.
              setDiscountPercent(1 - totalInclTax / totalInclTaxExclDiscounts);
              // FIXME: send segment alert here too
            }
          },
          () => {
            // ignore any errors - we just won't show the discount to the user then
          },
        );
    }
  }, [username, verifiedMode]);

  function CloseText() {
    return (
      <span>
        {intl.formatMessage(messages.streakButton)}
        <span className="sr-only">. {intl.formatMessage(messages.streakButtonSrOnly)}</span>
      </span>
    );
  }

  let upgradeUrl;
  let mode;
  let offer;

  if (verifiedMode) {
    // FIXME: is it OK to pass this code in, if it doesn't exist? (thinking of Open edX)
    // If not, set it on the offer's upgradeUrl below
    upgradeUrl = `${verifiedMode.upgradeUrl}&code=ZGY11119949`;
    mode = {
      currencySymbol: verifiedMode.currencySymbol,
      price: verifiedMode.price,
      upgradeUrl,
    };

    if (discountPercent) {
      const discountMultipler = 1 - discountPercent;
      offer = {
        discountedPrice: `${verifiedMode.currencySymbol}${(mode.price * discountMultipler).toFixed(2).toString()}`,
        originalPrice: `${verifiedMode.currencySymbol}${mode.price.toString()}`,
        upgradeUrl: mode.upgradeUrl,
      };
    }
  }

  const title = `${streakLengthToCelebrate} ${intl.formatMessage(messages.streakHeader)}`;
  const showOffer = offer && StreakDiscountCouponEnabled;

  return (
    <ModalDialog
      className="streak-modal modal-dialog-centered"
      title={title}
      onClose={() => {
        closeStreakCelebration();
        recordModalClosing(metadataModel, celebrations, org, courseId, dispatch);
      }}
      isOpen={isStreakCelebrationOpen}
      isFullscreenScroll
      {...rest}
    >
      <ModalDialog.Header className="modal-header">
        <ModalDialog.Title className="mr-0 modal-title">
          {title}
        </ModalDialog.Title>
      </ModalDialog.Header>
      <ModalDialog.Body className="modal-body">
        <p>{intl.formatMessage(messages.streakBody)}</p>
        <p className="modal-image">
          <OnMobile>
            <img src={StreakMobileImage} alt="" className="img-fluid" />
          </OnMobile>
          <OnDesktop>
            <img src={StreakDesktopImage} alt="" className="img-fluid" />
          </OnDesktop>
        </p>
        { !showOffer && (
          <div className="d-flex py-3 bg-light-300">
            <Icon className="col-small ml-3" src={Lightbulb} />
            <div className="col-11 factoid-wrapper">
              {randomFactoid}
            </div>
          </div>
        )}
        { showOffer && (
          <Alert variant="success" className="px-0">
            <div className="d-flex">
              <Icon className="col-small ml-3 text-success-500" src={MoneyFilled} />
              <div className="col-11 factoid-wrapper">
                <b>{intl.formatMessage(messages.congratulations)}</b>
                &nbsp;{intl.formatMessage(messages.streakDiscountMessage, { percent: (discountPercent * 100).toFixed(0) })}&nbsp;
                <FormattedMessage
                  id="learning.streakCelebration.streakCelebrationCouponEndDateMessage"
                  defaultMessage="Ends {date}."
                  values={{
                    date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString({ timeZone: 'UTC' }),
                  }}
                />
              </div>
            </div>
          </Alert>
        )}
      </ModalDialog.Body>
      <ModalDialog.Footer className="modal-footer d-block">
        { showOffer && (
          <>
            <OnMobile>
              <UpgradeNowButton
                className="upgrade mb-3"
                size="sm"
                offer={offer}
                variant="brand"
                verifiedMode={mode}
              />
              <ModalDialog.CloseButton variant="outline-brand" className="btn-sm">
                {intl.formatMessage(messages.streakButtonAA759)}
              </ModalDialog.CloseButton>
            </OnMobile>
            <OnDesktop>
              <UpgradeNowButton
                className="upgrade mb-3"
                offer={offer}
                variant="brand"
                verifiedMode={mode}
              />
              <ModalDialog.CloseButton variant="outline-brand">
                {intl.formatMessage(messages.streakButtonAA759)}
              </ModalDialog.CloseButton>
            </OnDesktop>
          </>
        )}
        { !showOffer && (
          <ModalDialog.CloseButton className="px-5" variant="primary"><CloseText /></ModalDialog.CloseButton>
        )}
      </ModalDialog.Footer>
    </ModalDialog>
  );
}

StreakModal.defaultProps = {
  isStreakCelebrationOpen: false,
  streakLengthToCelebrate: -1,
  verifiedMode: {},
  StreakDiscountCouponEnabled: false,
};

StreakModal.propTypes = {
  courseId: PropTypes.string.isRequired,
  metadataModel: PropTypes.string.isRequired,
  streakLengthToCelebrate: PropTypes.number,
  intl: intlShape.isRequired,
  isStreakCelebrationOpen: PropTypes.bool,
  closeStreakCelebration: PropTypes.func.isRequired,
  StreakDiscountCouponEnabled: PropTypes.bool,
  verifiedMode: PropTypes.shape({
    currencySymbol: PropTypes.string,
    price: PropTypes.number,
    upgradeUrl: PropTypes.string,
  }),
};

export default injectIntl(StreakModal);
