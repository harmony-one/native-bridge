import React, { Component } from "react";
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import {
  Typography,
  Grid,
  Link
} from '@material-ui/core';
import { colors } from '../../theme'

import {
  FEES_UPDATED
} from '../../constants'

import Store from "../../stores";
const emitter = Store.emitter
const store = Store.store

const styles = theme => ({
  root: {
    width: '525px',
    marginBottom: '24px'
  },
  header: {
    fontSize: '2.4rem',
    color: colors.yellow,
    marginBottom: '24px',
    fontWeight: 700,
    fontFamily: ['Source Sans Pro', 'sans-serif'].join(","),
  },
  action: {
    fontSize: '1rem',
    color: colors.lightBlack,
    display: 'inline-block',
    marginTop: "0.5rem"
  },
  actionHighlight: {
    fontSize: '0.9rem',
    color: '#000000',
    display: 'inline-block',
    marginTop: "0.5rem"  
  },
  actionLink: {
    fontSize: '0.9rem',
    color: '#2196f3',
    display: 'inline-block',
    marginTop: "0.5rem"
  },
  action2: {
    fontSize: '0.85rem',
    color: colors.lightBlack,
    display: 'inline-block',
    marginTop: "0.5rem"
  },
  actionRed: {
    fontSize: '1rem',
    color: colors.lightBlack,
    display: 'inline-block',
    marginTop: "0.5rem",
    fontWeight: 'bold'
  },
  price: {
    paddingRight: '60px',
    fontSize: '1rem',
    color: colors.lightBlack,
    display: 'inline-block',
    marginTop: "0.5rem"
  }
});

class Instructions extends Component {
  state = {
    fees: []
  };

  componentDidMount() {
    emitter.on(FEES_UPDATED, this.feesUpdated);
  };

  componentWillUnmount() {
    emitter.removeListener(FEES_UPDATED, this.feesUpdated);
  };

  feesUpdated = () => {
    const fees = store.getStore('fees')

    let feesDisplay = fees.map((fee) => {
      let description = ""

      switch (fee.msg_type) {
        case 'submit_proposal':
          description = 'Submit Listing Proposal'
          break;
        case 'dexList':
          description = 'Listing On DEX'
          break;
        case 'issueMsg':
          description = 'Issue New Token'
          break;
        case 'send':
          description = 'Transfer Tokens'
          break;
        case 'list_proposal_deposit':
          description = 'Listing Proposal Deposit'
          break;
        default:
          break;
      }

      return {
        description: description,
        price: fee.fee / 100000000
      }
    })

    this.setState({
      fees,
      feesDisplay: feesDisplay,
    })
  };

  renderBep2ToOne() {
    const {
      classes
    } = this.props;

    return (
      <Grid
        container
        justify="flex-start"
        display="table">
        <Grid style={{ display: 'table', }} item xs={12} align='left'>
          <div style={{ display: 'table', }} className={classes.root}>
            <Typography className={classes.header} style={{ marginTop: '10px' }}>With bnbridge you can:</Typography>
            <li><Typography className={classes.action}>Swap between ONE and BEP2 tokens</Typography></li>
          </div>
        </Grid>
      </Grid>
    )
  };

  renderOneToBep2() {
    const {
      classes
    } = this.props;

    return (
      <Grid
        container
        justify="flex-start"
        display="table">
        <Grid style={{ display: 'table', }} item xs={12} align='left'>
          <div style={{ display: 'table', }} className={classes.root}>
            <Typography className={classes.header} style={{ marginTop: '70px' }}>With bnbridge you can:</Typography>
            <li><Typography className={classes.action}>Swap between ONE and BEP2 tokens</Typography></li>
          </div>
          <div>
            <Typography className={classes.actionHighlight}>
              If you are using a binance.com account, your 9 digit ONE deposit memo is required in addition to your ONE address.
              <br/>
              <Link href="https://www.binance.vision/tutorials/how-to-deposit">
                <Typography className={classes.actionLink}> How to find your deposit MEMO?</Typography>
              </Link>   
            </Typography>
            <img src={ require('../../assets/images/MEMO_Example.png')} style={{width: '80%'}} alt="Nature"></img>
          </div>
        </Grid>
      </Grid>
    )
  };

  render() {
    const {
      classes,
      swapDir
    } = this.props;

    return (
      <Grid container className={ classes.root }>
          { swapDir === 'Bep2ToOne' && this.renderBep2ToOne() }
          { swapDir === 'OneToBep2' && this.renderOneToBep2() }
      </Grid>
    )
  }

  renderFees = () => {
    const {
      classes
    } = this.props;

    if (!this.state.feesDisplay) {
      return null
    }

    return this.state.feesDisplay.map((fee) => {
      return (
        <React.Fragment key={fee.description}>
          <Grid item xs={6} align='left' className={classes.action}>
            {fee.description}
          </Grid>
          <Grid item xs={6} align='right' className={classes.price}>
            {fee.price} BNB
          </Grid>
        </React.Fragment>
      )
    })
  };
}

Instructions.propTypes = {
  classes: PropTypes.object.isRequired
};

export default withStyles(styles)(Instructions);
