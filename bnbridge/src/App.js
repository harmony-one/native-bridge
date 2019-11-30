import React from 'react';
import CssBaseline from '@material-ui/core/CssBaseline';
import { createMuiTheme, MuiThemeProvider } from '@material-ui/core/styles';
import { Grid } from '@material-ui/core';

import bnbridgeTheme from './theme';

import Instructions from './components/instructions';
import Controller from './components/controller';
import Swaps from './components/swaps';

require('dotenv').config();

class App extends React.Component{
  constructor(props) {
    super(props)

    this.state = {
      swapDir: 'Bep2ToOne'
    };
  }

  changeSwapDir = (change) => {
    console.log(change)
    const swapDir = change
    this.setState({swapDir : swapDir})
  }

  render() {
    return (
      <MuiThemeProvider theme={ createMuiTheme(bnbridgeTheme) }>
        <CssBaseline />
        <Grid
          style={{
            padding: '5% 20% 5% 10%',
            minWidth: 'fit-content',
            marginLeft: '5.5%',
          }}
          container
          justify="center"
          alignItems="center"
          direction="row"
          >
          <Grid item style={{ display: 'table' }} align='center'>
            <Instructions swapDir={ this.state.swapDir }/>
          </Grid>
          <Grid item style={{ display: 'table', padding: '5%' }} align="center">
            <Controller changeSwapDir={ this.changeSwapDir }/>
          </Grid>
        </Grid>
        <Grid
          style={{ padding: '0% 10%', display: 'table'}}
          container
          justify="center"
          alignItems="center"
          direction="row">
          <Grid item align="center">
            <Swaps />
          </Grid>
        </Grid>
      </MuiThemeProvider>
    );
  }
}

export default App;
