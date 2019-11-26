import React, { Component } from "react";
import PropTypes from 'prop-types';
import { colors } from '../../theme/theme'

import { withStyles } from '@material-ui/core/styles';

import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableFooter from "@material-ui/core/TableFooter";
import TablePagination from "@material-ui/core/TablePagination";
import TableRow from '@material-ui/core/TableRow';
import IconButton from "@material-ui/core/IconButton";

import FirstPage from "@material-ui/icons/FirstPage";
import KeyboardArrowLeft from "@material-ui/icons/KeyboardArrowLeft";
import KeyboardArrowRight from "@material-ui/icons/KeyboardArrowRight";
import LastPage from "@material-ui/icons/LastPage";

import Tooltip from "react-simple-tooltip"

import {
  SWAPS_UPDATED,
  GET_SWAPS,
} from '../../constants/constants'

import Store from "../../stores/store";
const emitter = Store.emitter
const dispatcher = Store.dispatcher
const store = Store.store

const actionsStyles = theme => ({
  root: {
    flexShrink: 0,
    color: theme.palette.text.secondary,
    marginLeft: theme.spacing.unit * 2.5
  }
});

class TablePaginationActions extends React.Component {
  handleFirstPageButtonClick = event => {
    this.props.onChangePage(event, 0);
  };

  handleBackButtonClick = event => {
    this.props.onChangePage(event, this.props.page - 1);
  };

  handleNextButtonClick = event => {
    this.props.onChangePage(event, this.props.page + 1);
  };

  handleLastPageButtonClick = event => {
    this.props.onChangePage(event, Math.max(0, Math.ceil(this.props.count / this.props.rowsPerPage) - 1));
  };

  render() {
    const { classes, count, page, rowsPerPage, theme } = this.props;

    return <div className={classes.root}>
      <IconButton onClick={this.handleFirstPageButtonClick}
        disabled={page === 0} aria-label="First Page">
        {theme.direction === 'rtl' ? <LastPage /> : <FirstPage />}
      </IconButton>
      <IconButton onClick={this.handleBackButtonClick}
        disabled={page === 0} aria-label="Previous Page">
        {theme.direction === 'rtl' ? <KeyboardArrowRight /> : <KeyboardArrowLeft />}
      </IconButton>
      <IconButton onClick={this.handleNextButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1} aria-label="Next Page">
        {theme.direction === 'rtl' ? <KeyboardArrowLeft /> : <KeyboardArrowRight />}
      </IconButton>
      <IconButton onClick={this.handleLastPageButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1} aria-label="Last Page">
        {theme.direction === 'rtl' ? <FirstPage /> : <LastPage />}
      </IconButton>
    </div>;
  }
}

TablePaginationActions.propTypes = {
  classes: PropTypes.object.isRequired,
  count: PropTypes.number.isRequired,
  onChangePage: PropTypes.func.isRequired,
  page: PropTypes.number.isRequired,
  rowsPerPage: PropTypes.number.isRequired,
  theme: PropTypes.object.isRequired
};

const TablePaginationActionsWrapped = withStyles(actionsStyles, { withTheme: true })(TablePaginationActions);

const styles = theme => ({
  root: {
    width: '800px',
    marginBottom: '24px'
  },
  header: {
    fontSize: '2.4rem',
    color: colors.yellow,
    marginBottom: '24px',
    fontWeight: 400,
    fontFamily: ['Source Sans Pro', 'sans-serif'].join(","),
  },
  action: {
    fontSize: '1rem',
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

class Swaps extends Component {

  state = {
    swaps: [],
    page: 0,
    rowsPerPage: 5
  };

  handleChangePage = (event, page) => {
    this.setState({ page });
  };

  handleChangeRowsPerPage = event => {
    this.setState({ page: 0, rowsPerPage: event.target.value });
  };

  componentDidMount() {
    emitter.on(SWAPS_UPDATED, this.swapsUpdated);
    dispatcher.dispatch({ type: GET_SWAPS, content: {} })
  };

  componentWillUnmount() {
    emitter.removeListener(SWAPS_UPDATED, this.swapsUpdated);
  };

  swapsUpdated = () => {
    const swaps = store.getStore('swaps')

    const swapsDisplay = swaps.map((swap) => {
      return {
        eth_address: swap.eth_address,
        bnb_address: swap.bnb_address,
        amount: swap.amount,
        deposit_transaction_hash: swap.deposit_transaction_hash,
        transfer_transaction_hash: swap.transfer_transaction_hash,
        processed: swap.processed,
        created: swap.created,
        direction: swap.direction,
      }
    })

    this.setState({
      swaps,
      swapsDisplay: swapsDisplay,
    })
  };

  render() {
    const { classes } = this.props;
    const { swaps, rowsPerPage, page } = this.state;
    const rowsPerPageNum = Number(rowsPerPage);
    const emptyRows = rowsPerPageNum - Math.min(rowsPerPageNum, swaps.length - page * rowsPerPageNum);

    return (
      <Table className={classes.table} style={{ tableLayout: 'fixed', marginBottom: '10rem', marginTop: '5rem' }} fixedheader={"false"}>
        <TableHead>
          <TableRow>
            <TableCell align="center">
              <Tooltip content="Time zone in UTC">Time</Tooltip>
            </TableCell>
            <TableCell align="center">
              <Tooltip content="Source account that made the deposit for swap.">From</Tooltip>
            </TableCell>
            <TableCell align="center">
              <Tooltip content="Destination account that received the swapped token.">To</Tooltip>
            </TableCell>
            <TableCell align="center">
              <Tooltip content="Unit is in One">Amount</Tooltip>
            </TableCell>
            <TableCell align="center">
              <Tooltip content="Deposit transaction hash">Deposit</Tooltip>
            </TableCell>
            <TableCell align="center">
              <Tooltip content="Receive transaction hash">Receive</Tooltip>
            </TableCell>
            <TableCell align="center">
              <Tooltip content="Swap direction">Direction</Tooltip>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {this.renderSwaps(swaps, page, rowsPerPageNum) }
          {
            emptyRows > 0 && (
              <TableRow style={{ height: 48 * emptyRows }}>
                <TableCell colSpan={6} />
              </TableRow>
            )
          }
        </TableBody>
        <TableFooter className={classes.footer}>
          <TableRow className={classes.footer}>
            <TablePagination rowsPerPageOptions={[5, 10, 25]} colSpan={3} count={swaps.length} rowsPerPage={rowsPerPageNum} page={page}
              SelectProps={{ native: true }} onChangePage={this.handleChangePage} onChangeRowsPerPage={this.handleChangeRowsPerPage}
              ActionsComponent={TablePaginationActionsWrapped} />
          </TableRow>
        </TableFooter>
      </Table>
    )
  };

  renderSwaps = (swaps, page, rowsPerPage) => {
    if (!this.state.swapsDisplay) {
      return null
    }

    return this.state.swapsDisplay
      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
      .map((swap) => {
        let from, fromLink, to, toLink, depositHash, depositLink, receiveHash, receiveLink, direction;

        if (swap.direction === 'BinanceToEthereum') {
          from = swap.bnb_address;
          fromLink = `https://explorer.binance.org/address/${swap.bnb_address}`
          to = swap.eth_address;
          toLink = `https://etherscan.io/address/${swap.eth_address}#tokentxns`
          depositHash = swap.deposit_transaction_hash;
          depositLink = "https://explorer.binance.org/tx/" + swap.deposit_transaction_hash;
          receiveHash = swap.transfer_transaction_hash;
          receiveLink = "https://etherscan.io/tx/" + swap.transfer_transaction_hash;
          direction = 'B2E';
        } else {
          from = swap.eth_address;
          fromLink = `https://etherscan.io/address/${swap.eth_address}#tokentxns`
          to = swap.bnb_address;
          toLink = `https://explorer.binance.org/address/${swap.bnb_address}`
          depositHash = swap.deposit_transaction_hash;
          depositLink = "https://etherscan.io/tx/" + swap.deposit_transaction_hash;
          receiveHash = swap.transfer_transaction_hash;
          receiveLink = "https://explorer.binance.org/tx/" + swap.transfer_transaction_hash;
          direction = 'E2B';
        }

        const timetokens = swap.created.split('T');
        const date = timetokens[0];
        const time = timetokens[1].replace('Z', '')
        const fromShort = from ? from.substring(0, 12) : ''
        const toShort = to ? to.substring(0, 12) : ''
        const depositHashShort = depositHash ? depositHash.substring(0, 12) : ''
        const receiveHashShort = receiveHash ? receiveHash.substring(0, 12) : ''
        const amount = parseFloat(swap.amount).toFixed(4)

        return <TableRow key={swap.transfer_transaction_hash}>
          <TableCell component="th" scope="row" style={{ padding: '8px' }}>
            <div style={{ marginTop: '4px', marginLeft: '20%' }}>{date}</div>
            <div style={{ marginBottom: '4px', marginLeft: '20%' }}>{time}</div>
          </TableCell>
          <TableCell align="center">
            <a href={fromLink} rel="noopener noreferrer" target="_blank">
              <Tooltip content={from}>{fromShort}</Tooltip>
            </a>
          </TableCell>
          <TableCell align="center">
            <a href={toLink} rel="noopener noreferrer" target="_blank">
              <Tooltip content={to}>{toShort}</Tooltip>
            </a>
          </TableCell>
          <TableCell align="center">{amount}</TableCell>
          <TableCell align="center">
            <a href={depositLink} rel="noopener noreferrer" target="_blank">
              <Tooltip content={depositHash}>{depositHashShort}</Tooltip>
            </a>
          </TableCell>
          <TableCell align="center">
            <a href={receiveLink} rel="noopener noreferrer" target="_blank">
              <Tooltip content={receiveHash}>{receiveHashShort}</Tooltip>
            </a>
          </TableCell>
          <TableCell align="center"><Tooltip content={swap.direction}>{direction}</Tooltip></TableCell>
        </TableRow>
      })
  }
}

Swaps.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(Swaps);
