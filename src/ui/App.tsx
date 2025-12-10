import {BrowserRouter as Router, Route, Routes, Navigate} from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Jobs from './pages/Jobs';
import Runtimes from './pages/Runtimes';
import Monitoring from './pages/Monitoring';
import Resources from './pages/Resources';
import {NodeProvider} from './contexts/NodeContext';
import {ApiProvider} from './providers/ApiProvider';
import {SettingsProvider} from './contexts/SettingsContext';

function App() {
    return (
        <NodeProvider>
            <SettingsProvider>
                <ApiProvider>
                    <Router>
                        <Layout>
                            <Routes>
                                <Route path="/" element={<Jobs/>}/>
                                <Route path="/jobs" element={<Navigate to="/" replace/>}/>
                                <Route path="/runtimes" element={<Runtimes/>}/>
                                <Route path="/monitoring" element={<Monitoring/>}/>
                                <Route path="/resources" element={<Resources/>}/>
                            </Routes>
                        </Layout>
                    </Router>
                </ApiProvider>
            </SettingsProvider>
        </NodeProvider>
    );
}

export default App;